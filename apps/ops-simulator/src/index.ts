import { NodeHttpClient, NodeRuntime, NodeSocket } from "@effect/platform-node";
import { Commands, type QualifiedName, type StreamingCommandHisotryEntry } from "@mrt/yamcs-effect";
import { Effect, Layer, Logger, Schedule, Stream } from "effect";

import type { ValveId } from "./domain.ts";

import { readParameters, makeInitialState, stepSimulation, setValve } from "./simulator.ts";
import { buildN20FillSystem } from "./topology.ts";
import {
  loadYamcsProcessorTarget,
  YamcsClient,
  YamcsClientLive,
  yamcsConfigLayer,
} from "./yamcs.ts";

const SIMULATION_TIMESTEP = 0.1;

const valveCommands = new Map<QualifiedName, { readonly valveId: ValveId; readonly open: number }>([
  ["/FlightComputer/fdov_energize", { valveId: "V-22", open: 1 }],
  ["/FlightComputer/fdov_de-energize", { valveId: "V-22", open: 0 }],
  ["/FlightComputer/vent_valve_energize", { valveId: "V-23", open: 1 }],
  ["/FlightComputer/vent_valve_de-energize", { valveId: "V-23", open: 0 }],
]);

const labJackDigitalPins = new Map<number, ValveId>([
  [0, "V-22"],
  [1, "V-23"],
]);

const commandStatus = (entry: StreamingCommandHisotryEntry, attributeName: string) => {
  const attribute = entry.attr.find((attr) => attr.name === attributeName);
  if (attribute?.value.type !== "STRING") {
    return undefined;
  }

  return attribute.value.value;
};

const commandReleased = (entry: StreamingCommandHisotryEntry) =>
  commandStatus(entry, "Acknowledge_Released_Status") === "OK" ||
  commandStatus(entry, "CommandComplete_Status") === "OK";

const assignment = (entry: StreamingCommandHisotryEntry, assignmentName: string) =>
  entry.assignments?.find((assignment) => assignment.name === assignmentName)?.value;

const numericAssignment = (entry: StreamingCommandHisotryEntry, assignmentName: string) => {
  const value = assignment(entry, assignmentName);
  switch (value?.type) {
    case "UINT32":
    case "SINT32":
    case "UINT64":
    case "SINT64":
    case "DOUBLE":
    case "FLOAT":
      return value.value;
    default:
      return undefined;
  }
};

const enumAssignment = (entry: StreamingCommandHisotryEntry, assignmentName: string) => {
  const value = assignment(entry, assignmentName);
  if (value?.type !== "ENUMERATED") {
    return undefined;
  }

  return value.value;
};

const valveActionFromCommand = (entry: StreamingCommandHisotryEntry) => {
  if (entry.commandName === "/EGSE/Pad/LabJack/write_digital_pin") {
    const valveId = labJackDigitalPins.get(numericAssignment(entry, "pin_number") ?? -1);
    const pinState = enumAssignment(entry, "pin_state");

    if (valveId === undefined || pinState === undefined) {
      return undefined;
    }

    return { valveId, open: pinState === "HIGH" ? 1 : 0 };
  }

  return valveCommands.get(entry.commandName);
};

const simulatorLayer = Layer.mergeAll(
  Commands.layer.pipe(
    Layer.provideMerge(NodeSocket.layerWebSocketConstructor),
    Layer.provide(yamcsConfigLayer),
  ),
  Logger.layer([Logger.consolePretty({ colors: true })]),
  YamcsClientLive,
).pipe(Layer.provideMerge(NodeHttpClient.layerUndici));

const runDemo = Effect.gen(function* () {
  const commands = yield* Commands;
  const yamcs = yield* YamcsClient;
  const target = yield* loadYamcsProcessorTarget;
  yield* Effect.log("Initialized YamcsApi HTTP client");

  const system = buildN20FillSystem();

  let state = makeInitialState(system);

  let tick = 1;

  const step = Effect.gen(function* () {
    state = stepSimulation(system, state, SIMULATION_TIMESTEP);
    const request = readParameters(system, state);

    yield* yamcs.parameter
      .batchSetParameterValues({
        params: target,
        payload: { request },
      })
      .pipe(
        Effect.catchReason("HttpClientError", "DecodeError", (e) =>
          e.response.json.pipe(Effect.flatMap(Effect.logError)),
        ),
      );

    tick++;
  });
  // run the simulation with dt=0.1
  yield* step.pipe(
    Effect.repeat(Schedule.spaced(`${SIMULATION_TIMESTEP} seconds`)),
    Effect.forkScoped,
  );

  // periodically report the state
  yield* Effect.log({
    tick,
    request: state,
  }).pipe(Effect.repeat(Schedule.spaced("5 second")), Effect.forkScoped);

  const seenCommandIds = new Set<string>();
  const cmdHistory = yield* commands.subscribeHistory();

  yield* cmdHistory.entries.pipe(
    Stream.runForEach((entries) =>
      Effect.gen(function* () {
        for (const entry of [...entries].reverse()) {
          if (seenCommandIds.has(entry.id) || !commandReleased(entry)) {
            continue;
          }

          seenCommandIds.add(entry.id);
          const action = valveActionFromCommand(entry);
          if (action === undefined) {
            continue;
          }

          state = setValve(state, action.valveId, action.open);
          yield* Effect.log({
            message: "Applied Yamcs command to ops simulator",
            command: entry.commandName,
            valveId: action.valveId,
            open: action.open,
          });
        }
      }),
    ),
    Effect.forkScoped,
  );

  // simulated program
  yield* Effect.log("Waiting for Yamcs commands");

  return yield* Effect.never;
}).pipe(Effect.provide(simulatorLayer), Effect.scoped);

NodeRuntime.runMain(runDemo);
