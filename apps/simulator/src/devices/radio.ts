import { Effect, Schedule } from "effect";

import {
  makeAstraActor,
  makeAstraEndpoint,
  runAstraActor,
  type AstraCommandMessage,
  type AstraDetail,
  type AstraStatus,
} from "../Simulator.ts";
import { getContainer } from "../utils/Container.ts";
import { makePacketBuilder } from "../utils/PacketBuilder.ts";
import {
  makeFlightComputerSimulation,
  parseFlightComputerCommand,
  type FlightComputerSimulation,
} from "./flight-computer.ts";

type RadioMode = "OFF" | "IDLE" | "TRANSMIT";
type RadioRole = "Pad" | "ControlStation";
type RadioCommand = "CLEAR" | "POWER_ON" | "POWER_OFF" | "UNKNOWN";

interface RadioState {
  readonly role: RadioRole;
  readonly mode: RadioMode;
  readonly status: AstraStatus;
  readonly detail: AstraDetail;
  readonly telemetryCount: number;
  readonly forwardedCount: number;
  readonly pendingTelemetryAck: {
    readonly cmdId: number;
    readonly releaseAt: number;
  } | null;
}

export interface RadioActorOptions {
  readonly baseTopic: string;
  readonly role: RadioRole;
  readonly forwardsFlightComputerCommands: boolean;
  readonly flightComputer: FlightComputerSimulation;
}

const parseRadioCommand = (commandText: string): RadioCommand => {
  switch (commandText.trim().toLowerCase()) {
    case "radio clear":
    case "clear":
      return "CLEAR";
    case "radio on":
      return "POWER_ON";
    case "radio off":
      return "POWER_OFF";
    default:
      return "UNKNOWN";
  }
};

const initialStateForRole = (role: RadioRole): RadioState => ({
  role,
  mode: "IDLE",
  status: "OK",
  detail:
    role === "Pad"
      ? "Pad radio is idle and ready to forward commands and telemetry."
      : "Radio is idle and ready to transmit telemetry.",
  telemetryCount: 0,
  forwardedCount: 0,
  pendingTelemetryAck: null,
});

export const makeRadioActor = (options: RadioActorOptions) =>
  Effect.gen(function* () {
    const endpoint = makeAstraEndpoint(options.baseTopic);
    const container = yield* getContainer(options.baseTopic, "TelemetryPacket");
    const buildPacket = yield* makePacketBuilder(container);

    return yield* makeAstraActor({
      name: options.baseTopic,
      initialState: initialStateForRole(options.role),
      make: (actor) => {
        const makeBehavior = Effect.gen(function* () {
          const services = yield* Effect.services();
          const runFork = Effect.runForkWith(services);

          const publishOwnState = Effect.gen(function* () {
            const currentState = yield* actor.currentState;
            yield* actor.publishStatus(endpoint, currentState.status);
            yield* actor.publishDetail(endpoint, currentState.detail);
          });

          const publishOwnTelemetry = Effect.gen(function* () {
            const currentState = yield* actor.currentState;

            if (currentState.mode === "OFF") {
              return;
            }

            const packet = yield* buildPacket;

            yield* actor.updateState((state) => ({
              ...state,
              telemetryCount: state.telemetryCount + 1,
            }));

            yield* actor.publishTelemetry(endpoint, packet);
          });

          const publishLinkedFlightComputer = Effect.gen(function* () {
            const currentState = yield* actor.currentState;

            if (currentState.mode === "OFF") {
              return;
            }

            const now = yield* Effect.sync(() => Date.now());
            const pendingAck = currentState.pendingTelemetryAck;

            if (pendingAck !== null && pendingAck.releaseAt <= now) {
              yield* actor.updateState((state) => ({
                ...state,
                pendingTelemetryAck:
                  state.pendingTelemetryAck?.cmdId === pendingAck.cmdId
                    ? null
                    : state.pendingTelemetryAck,
              }));
              yield* options.flightComputer.publishTelemetryWithAck(
                actor,
                pendingAck.cmdId,
              );
              return;
            }

            yield* options.flightComputer.publishTelemetry(actor);
          });

          const publishLinkedFlightComputerState = Effect.gen(function* () {
            const currentState = yield* actor.currentState;

            if (currentState.mode === "OFF") {
              return;
            }

            yield* options.flightComputer.publishState(actor);
          });

          const handleOwnCommand = (command: AstraCommandMessage) =>
            Effect.gen(function* () {
              const commandType = parseRadioCommand(command.text);
              const nextState = yield* actor.updateState((currentState) => {
                switch (commandType) {
                  case "CLEAR":
                    return {
                      ...currentState,
                      mode: "IDLE",
                      status: "OK",
                      detail: "Radio is idle and ready to transmit telemetry.",
                    };
                  case "POWER_ON":
                    return {
                      ...currentState,
                      mode: "IDLE",
                      status: "OK",
                      detail:
                        currentState.role === "Pad"
                          ? "Pad radio is powered on and ready to forward commands and telemetry."
                          : "Radio is powered on and ready to transmit telemetry.",
                    };
                  case "POWER_OFF":
                    return {
                      ...currentState,
                      mode: "OFF",
                      status: "UNAVAIL",
                      detail:
                        "Radio is powered off and not forwarding telemetry.",
                    };
                  default:
                    return {
                      ...currentState,
                      status: "FAILED",
                      detail: `Radio did not understand command "${command.text}".`,
                    };
                }
              });

              yield* Effect.log(
                `[${options.baseTopic}] radio command=${command.text} status=${nextState.status}`,
              );
              yield* publishOwnState;
            });

          const handleFlightComputerCommand = (command: AstraCommandMessage) =>
            Effect.gen(function* () {
              const parsedCommand = parseFlightComputerCommand(command.text);

              if (parsedCommand === null) {
                yield* actor.updateState((currentState) => ({
                  ...currentState,
                  status: "FAILED",
                  detail:
                    "Pad radio received an invalid flight computer command string.",
                }));
                yield* publishOwnState;
                return;
              }

              const currentState = yield* actor.currentState;

              if (currentState.mode === "OFF") {
                yield* actor.publishAck(endpoint, {
                  cmd_id: parsedCommand.cmdId,
                  status: "RX_FAIL",
                });
                yield* actor.updateState((state) => ({
                  ...state,
                  status: "UNAVAIL",
                  detail:
                    "Pad radio cannot forward flight computer commands while powered off.",
                }));
                yield* publishOwnState;
                return;
              }

              yield* actor.updateState((state) => ({
                ...state,
                mode: "TRANSMIT",
                status: "OK",
                detail: `Pad radio queued command ${command.text} for uplink.`,
                forwardedCount: state.forwardedCount + 1,
              }));
              yield* publishOwnState;
              yield* actor.publishAck(endpoint, {
                cmd_id: parsedCommand.cmdId,
                status: "RX_OK",
              });

              yield* Effect.sleep("200 millis");

              const txAckStatus = yield* Effect.sync(() =>
                Math.random() < 0.1 ? "TX_NOK" : "TX_OK",
              );

              yield* actor.publishAck(endpoint, {
                cmd_id: parsedCommand.cmdId,
                status: txAckStatus,
              });

              if (txAckStatus === "TX_NOK") {
                yield* actor.updateState((state) => ({
                  ...state,
                  mode: "IDLE",
                  status: "FAILED",
                  detail: `Pad radio failed to uplink command ${command.text}.`,
                }));
                yield* publishOwnState;
                return;
              }

              yield* options.flightComputer.acceptCommand(command.text);
              yield* options.flightComputer.publishState(actor);

              const ackDelayMillis = yield* Effect.sync(
                () => 1000 + Math.floor(Math.random() * 2001),
              );
              const ackReleaseAt = yield* Effect.sync(
                () => Date.now() + ackDelayMillis,
              );

              yield* actor.updateState((state) => ({
                ...state,
                pendingTelemetryAck: {
                  cmdId: parsedCommand.cmdId,
                  releaseAt: ackReleaseAt,
                },
              }));

              yield* Effect.sync(() => {
                runFork(
                  publishLinkedFlightComputer.pipe(
                    Effect.delay(`${ackDelayMillis} millis`),
                  ),
                );
              });

              yield* actor.updateState((state) => ({
                ...state,
                mode: "IDLE",
                status: "OK",
                detail:
                  "Pad radio forwarded the latest command and returned to idle.",
              }));
              yield* publishOwnState;
            });

          const commandRoutes = [
            {
              endpoint,
              handleCommand: handleOwnCommand,
            },
            ...(options.forwardsFlightComputerCommands
              ? [
                  {
                    endpoint: options.flightComputer.endpoint,
                    handleCommand: handleFlightComputerCommand,
                  },
                ]
              : []),
          ] as const;

          return {
            boot: Effect.gen(function* () {
              yield* publishOwnState;
              yield* publishLinkedFlightComputerState;
              yield* publishOwnTelemetry.pipe(
                Effect.repeat(Schedule.spaced("2 seconds")),
                Effect.forkScoped,
              );
              yield* publishLinkedFlightComputer.pipe(
                Effect.repeat(Schedule.spaced("2 seconds")),
                Effect.forkScoped,
              );
              yield* publishOwnState.pipe(
                Effect.repeat(Schedule.spaced("5 seconds")),
                Effect.forkScoped,
              );
              yield* publishLinkedFlightComputerState.pipe(
                Effect.repeat(Schedule.spaced("5 seconds")),
                Effect.forkScoped,
              );
            }),
            commandRoutes,
          };
        });

        return makeBehavior;
      },
    });
  });

export const makeRadioSimulator = (options: RadioActorOptions) =>
  makeRadioActor(options).pipe(Effect.flatMap(runAstraActor));

export const makeStandaloneRadioWithFlightComputer = (
  baseTopic: string,
  role: RadioRole,
) =>
  Effect.gen(function* () {
    const systemBase = baseTopic.split("/").slice(0, 1)[0] ?? "System";
    const flightComputer = yield* makeFlightComputerSimulation(
      `${systemBase}/Rocket/FlightComputer`,
    );

    return yield* makeRadioActor({
      baseTopic,
      role,
      forwardsFlightComputerCommands: role === "Pad",
      flightComputer,
    });
  });
