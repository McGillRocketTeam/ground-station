import { Effect, Ref } from "effect";

import {
  makeAstraEndpoint,
  type AstraCommandText,
  type AstraDetail,
  type AstraEndpoint,
  type AstraPublisher,
  type AstraStatus,
} from "../Simulator.ts";
import { getContainer } from "../utils/Container.ts";
import { makePacketBuilder } from "../utils/PacketBuilder.ts";

type FlightComputerPhase = "PAD" | "ARMED" | "IN_FLIGHT" | "LANDED" | "FAULT";

interface FlightComputerState {
  readonly phase: FlightComputerPhase;
  readonly status: AstraStatus;
  readonly detail: AstraDetail;
  readonly telemetryCount: number;
  readonly lastCommandId: number | null;
  readonly pendingAckId: number | null;
  readonly pendingAckCode: string | null;
}

export interface FlightComputerCommand {
  readonly cmdId: number;
  readonly code: string;
}

export interface FlightComputerSimulation {
  readonly endpoint: AstraEndpoint;
  readonly currentState: Effect.Effect<FlightComputerState>;
  readonly publishState: (publisher: AstraPublisher) => Effect.Effect<void>;
  readonly publishTelemetry: (publisher: AstraPublisher) => Effect.Effect<void>;
  readonly publishTelemetryWithAck: (
    publisher: AstraPublisher,
    ackId: number,
  ) => Effect.Effect<void>;
  readonly acceptCommand: (
    commandText: AstraCommandText,
  ) => Effect.Effect<void>;
}

const flightComputerCommands = {
  ea: "armed recovery outputs",
  uh: "switched battery to umbilical",
  ed: "disarmed recovery outputs",
  eD: "triggered drogue ejection",
  pc: "processed emergency cancel",
  pe: "processed emergency stop",
  p5: "de-energized FDOV",
  p4: "energized FDOV",
  el: "marked flight as landed",
  pl: "processed launch command",
  eM: "triggered main ejection",
  p2: "armed MOV",
  p3: "disarmed MOV",
  po: "turned propulsion off",
  pi: "turned propulsion on",
  "r+": "set radio to normal TX speed",
  "r-": "set radio to slow TX speed",
  rs: "reset avionics",
  pr: "reset propulsion valve states",
  sc: "closed SD card",
  sd: "deleted SD data",
  sa: "armed SD deletion",
  si: "disarmed SD deletion",
  so: "opened SD card",
  ul: "switched umbilical to battery",
  p1: "de-energized vent valve",
  p0: "energized vent valve",
} as const;

const initialState: FlightComputerState = {
  phase: "PAD",
  status: "OK",
  detail: "Flight computer is on the pad and reporting nominal telemetry.",
  telemetryCount: 0,
  lastCommandId: null,
  pendingAckId: null,
  pendingAckCode: null,
};

export const parseFlightComputerCommand = (
  commandText: string,
): FlightComputerCommand | null => {
  const [idPart, codePart] = commandText.split(",", 2);

  if (idPart === undefined || codePart === undefined) {
    return null;
  }

  const cmdId = Number.parseInt(idPart.trim(), 10);
  const code = codePart.trim();

  if (
    !Number.isInteger(cmdId) ||
    cmdId < 1 ||
    cmdId > 255 ||
    code.length === 0
  ) {
    return null;
  }

  return { cmdId, code };
};

const nextPhaseForCommand = (
  currentPhase: FlightComputerPhase,
  code: string,
): FlightComputerPhase => {
  switch (code) {
    case "ea":
      return "ARMED";
    case "ed":
      return "PAD";
    case "pl":
      return "IN_FLIGHT";
    case "el":
      return "LANDED";
    case "pc":
    case "pe":
      return "FAULT";
    default:
      return currentPhase;
  }
};

const injectAckIntoPacketHeader = (packet: Uint8Array, ackId: number) => {
  const nextPacket = Buffer.from(packet);

  if (nextPacket.length >= 4) {
    nextPacket[2] = (nextPacket[2] ?? 0) | 0b10;
    nextPacket[3] = ackId & 0xff;
  }

  return nextPacket;
};

export const makeFlightComputerSimulation = (baseTopic: string) =>
  Effect.gen(function* () {
    const endpoint = makeAstraEndpoint(baseTopic);
    const state = yield* Ref.make(initialState);
    const container = yield* getContainer(baseTopic, "FCFrame");
    const buildPacket = yield* makePacketBuilder(container);

    const updateState = (
      update: (currentState: FlightComputerState) => FlightComputerState,
    ) =>
      Ref.modify(state, (currentState) => {
        const nextState = update(currentState);
        return [nextState, nextState] as const;
      });

    const publishState = (publisher: AstraPublisher) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state);
        yield* publisher.publishStatus(endpoint, currentState.status);
        yield* publisher.publishDetail(endpoint, currentState.detail);
      });

    const publishTelemetryInternal = (
      publisher: AstraPublisher,
      ackId?: number,
    ) =>
      Effect.gen(function* () {
        const packet = yield* buildPacket;
        const nextState = yield* updateState((currentState) => {
          if (
            ackId !== undefined &&
            currentState.pendingAckId === ackId &&
            currentState.pendingAckId !== null &&
            currentState.pendingAckCode !== null
          ) {
            return {
              ...currentState,
              status: "OK",
              detail: `Flight computer acknowledged command ${currentState.pendingAckId},${currentState.pendingAckCode} in telemetry.`,
              telemetryCount: currentState.telemetryCount + 1,
              pendingAckId: null,
              pendingAckCode: null,
            };
          }

          return {
            ...currentState,
            telemetryCount: currentState.telemetryCount + 1,
          };
        });

        yield* publisher.publishTelemetry(
          endpoint,
          ackId === undefined
            ? packet
            : injectAckIntoPacketHeader(packet, ackId),
        );
        yield* publisher.publishStatus(endpoint, nextState.status);
        yield* publisher.publishDetail(endpoint, nextState.detail);
      });

    const publishTelemetry = (publisher: AstraPublisher) =>
      publishTelemetryInternal(publisher);

    const publishTelemetryWithAck = (
      publisher: AstraPublisher,
      ackId: number,
    ) => publishTelemetryInternal(publisher, ackId);

    const acceptCommand = (commandText: AstraCommandText) =>
      Effect.gen(function* () {
        const command = parseFlightComputerCommand(commandText);

        if (command === null) {
          yield* updateState((currentState) => ({
            ...currentState,
            status: "FAILED",
            detail: "Flight computer received an invalid command string.",
          }));
          return;
        }

        const commandDescription =
          flightComputerCommands[
            command.code as keyof typeof flightComputerCommands
          ];

        if (commandDescription === undefined) {
          yield* updateState((currentState) => ({
            ...currentState,
            status: "FAILED",
            detail: `Flight computer rejected unsupported command ${command.code}.`,
          }));
          return;
        }

        yield* updateState((currentState) => ({
          ...currentState,
          phase: nextPhaseForCommand(currentState.phase, command.code),
          status:
            command.code === "pc" || command.code === "pe" ? "FAILED" : "OK",
          detail: `Flight computer ${commandDescription} and will report ack ${command.cmdId} in telemetry.`,
          lastCommandId: command.cmdId,
          pendingAckId: command.cmdId,
          pendingAckCode: command.code,
        }));
      });

    return {
      endpoint,
      currentState: Ref.get(state),
      publishState,
      publishTelemetry,
      publishTelemetryWithAck,
      acceptCommand,
    } satisfies FlightComputerSimulation;
  });
