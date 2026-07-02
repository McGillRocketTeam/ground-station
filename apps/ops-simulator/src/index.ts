import { NodeHttpClient, NodeRuntime, NodeSocket } from "@effect/platform-node";
import { Commands, YamcsConfig } from "@mrt/yamcs-effect";
import { Effect, Layer, Logger, Schedule, Stream } from "effect";

import { readParameters, makeInitialState, stepSimulation, setValve } from "./simulator.ts";
import { buildN20FillSystem } from "./topology.ts";
import {
  loadYamcsProcessorTarget,
  YamcsClient,
  YamcsClientLive,
  yamcsConfigLayer,
} from "./yamcs.ts";

const SIMULATION_TIMESTEP = 0.1;

const simulatorLayer = Layer.mergeAll(
  // Commands.layer.pipe(
  //   Layer.provideMerge(NodeSocket.layerWebSocketConstructor),
  //   Layer.provide(yamcsConfigLayer),
  // ),
  Logger.layer([Logger.consolePretty({ colors: true })]),
  YamcsClientLive.pipe(),
).pipe(Layer.provideMerge(NodeHttpClient.layerUndici));

const runDemo = Effect.gen(function* () {
  // const commands = yield* Commands;
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
  yield* Effect.gen(function* () {
    return yield* Effect.log({
      tick,
      request: state,
    });
  }).pipe(Effect.repeat(Schedule.spaced("5 second")), Effect.forkScoped);

  // const cmdHistory = yield* commands.subscribeHistory();

  // todo: filter for valve commands and then update them in the simulation
  // yield* cmdHistory.entries.pipe(Stream.runDrain, Effect.forkScoped);

  // simulated program
  yield* Effect.sleep("20 seconds");
  state = setValve(state, "V-22", 1);
  yield* Effect.sleep("20 seconds");
  state = setValve(state, "V-22", 0);

  return yield* Effect.never;
}).pipe(Effect.provide(simulatorLayer), Effect.scoped);

NodeRuntime.runMain(runDemo);
