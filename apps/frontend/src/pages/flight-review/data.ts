import { Context, Effect, Layer, SubscriptionRef } from "effect";

import { frontendRuntimeFactory } from "@/lib/atom/yamcs/runtime";

import telemetryCsv from "./data/telemetry-flight-window.csv?raw";

const TIME_COLUMN = "Time";
const FLIGHT_STAGE_COLUMN = "/SystemB/Rocket/FlightComputer/flight_stage";
const GPS_ALTITUDE_COLUMN = "/SystemB/Rocket/FlightComputer/gps_altitude";
const GPS_LATITUDE_COLUMN = "/SystemB/Rocket/FlightComputer/gps_latitude";
const GPS_LONGITUDE_COLUMN = "/SystemB/Rocket/FlightComputer/gps_longitude";
const TELEMETRY_DISCONNECT_GAP_MS = 2000;

export type FlightPacket = {
  readonly time: string;
  readonly timeMs: number;
  readonly flightStage: string;
  readonly parameters: Readonly<Record<string, string | undefined>>;
};

export type FlightStageWindow = {
  readonly id: string;
  readonly stage: string;
  readonly start: string;
  readonly startMs: number;
  readonly end: string;
  readonly endMs: number;
};

export type TelemetryConnectionWindow = {
  readonly id: string;
  readonly start: string;
  readonly startMs: number;
  readonly end: string;
  readonly endMs: number;
  readonly packetCount: number;
};

export type FlightReplayGpsState = {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude?: number;
  readonly packetTime: string;
};

export type FlightReplayGpsTrackPoint = FlightReplayGpsState & {
  readonly packetIndex: number;
  readonly flightStage: string;
};

export type FlightReplayState = {
  readonly parameterNames: ReadonlyArray<string>;
  readonly packets: ReadonlyArray<FlightPacket>;
  readonly gpsTrack: ReadonlyArray<FlightReplayGpsTrackPoint>;
  readonly stages: ReadonlyArray<FlightStageWindow>;
  readonly telemetryConnections: ReadonlyArray<TelemetryConnectionWindow>;
  readonly telemetryDisconnectGapMs: number;
  readonly flightStart: string;
  readonly flightStartMs: number;
  readonly flightEnd: string;
  readonly flightEndMs: number;
  readonly currentCursorTime: string;
  readonly currentCursorTimeMs: number;
  readonly currentCursorPacketIndex: number;
  readonly currentPacket?: FlightPacket;
  readonly currentFlightStage: string;
  readonly currentGpsState?: FlightReplayGpsState;
};

type ParsedTelemetryCsv = {
  readonly parameterNames: ReadonlyArray<string>;
  readonly packets: ReadonlyArray<FlightPacket>;
};

const toOptionalNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const toGpsState = (packet: FlightPacket | undefined): FlightReplayGpsState | undefined => {
  if (!packet) {
    return undefined;
  }

  const latitude = toOptionalNumber(packet.parameters[GPS_LATITUDE_COLUMN]);
  const longitude = toOptionalNumber(packet.parameters[GPS_LONGITUDE_COLUMN]);

  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  return {
    latitude,
    longitude,
    altitude: toOptionalNumber(packet.parameters[GPS_ALTITUDE_COLUMN]),
    packetTime: packet.time,
  };
};

const hasSameGpsCoordinates = (
  left: FlightReplayGpsState | undefined,
  right: FlightReplayGpsState | undefined,
) => left?.latitude === right?.latitude && left?.longitude === right?.longitude;

const buildGpsTrack = (
  packets: ReadonlyArray<FlightPacket>,
): ReadonlyArray<FlightReplayGpsTrackPoint> => {
  const track: Array<FlightReplayGpsTrackPoint> = [];
  let previousPoint: FlightReplayGpsState | undefined;

  for (const [packetIndex, packet] of packets.entries()) {
    const gpsState = toGpsState(packet);

    if (!gpsState || hasSameGpsCoordinates(previousPoint, gpsState)) {
      continue;
    }

    track.push({ ...gpsState, packetIndex, flightStage: packet.flightStage });
    previousPoint = gpsState;
  }

  return track;
};

const parseTelemetryCsv = (csv: string): ParsedTelemetryCsv => {
  const [header, ...lines] = csv.trim().split(/\r?\n/);

  if (!header) {
    return { parameterNames: [], packets: [] };
  }

  const columns = header.split(",");
  const parameterNames = columns.filter((column) => column !== TIME_COLUMN);
  const previousValues = new Map<string, string>();

  const packets = lines
    .map((line) => line.split(","))
    .filter((parts) => parts.length >= 2)
    .map((parts) => {
      const row = Object.fromEntries(
        columns.map((column, index) => {
          const rawValue = parts[index];

          if (column === TIME_COLUMN) {
            return [column, rawValue || undefined];
          }

          if (rawValue !== undefined && rawValue !== "") {
            previousValues.set(column, rawValue);
            return [column, rawValue];
          }

          return [column, previousValues.get(column)];
        }),
      );
      const time = row[TIME_COLUMN];

      return {
        time: time ?? "",
        timeMs: new Date(time ?? "").getTime(),
        flightStage: row[FLIGHT_STAGE_COLUMN] ?? "Unknown",
        parameters: Object.fromEntries(
          parameterNames.map((parameterName) => [parameterName, row[parameterName]]),
        ),
      } satisfies FlightPacket;
    })
    .filter((packet) => packet.time !== "" && Number.isFinite(packet.timeMs));

  return { parameterNames, packets };
};

const buildStageWindows = (
  packets: ReadonlyArray<FlightPacket>,
): ReadonlyArray<FlightStageWindow> => {
  if (packets.length === 0) {
    return [];
  }

  const windows: Array<FlightStageWindow> = [];
  let currentStage = packets[0].flightStage;
  let currentStart = packets[0];

  for (let index = 1; index < packets.length; index += 1) {
    const packet = packets[index];

    if (packet.flightStage === currentStage) {
      continue;
    }

    windows.push({
      id: `stage-${windows.length}`,
      stage: currentStage,
      start: currentStart.time,
      startMs: currentStart.timeMs,
      end: packet.time,
      endMs: packet.timeMs,
    });

    currentStage = packet.flightStage;
    currentStart = packet;
  }

  const lastPacket = packets[packets.length - 1];
  windows.push({
    id: `stage-${windows.length}`,
    stage: currentStage,
    start: currentStart.time,
    startMs: currentStart.timeMs,
    end: lastPacket.time,
    endMs: lastPacket.timeMs,
  });

  return windows;
};

const buildTelemetryConnectionWindows = (
  packets: ReadonlyArray<FlightPacket>,
  disconnectGapMs: number,
): ReadonlyArray<TelemetryConnectionWindow> => {
  if (packets.length === 0) {
    return [];
  }

  const windows: Array<TelemetryConnectionWindow> = [];
  let currentStart = packets[0];
  let currentEnd = packets[0];
  let packetCount = 1;

  const pushWindow = () => {
    const endMs = Math.max(currentEnd.timeMs, currentStart.timeMs + 1);

    windows.push({
      id: `telemetry-${windows.length}`,
      start: currentStart.time,
      startMs: currentStart.timeMs,
      end: new Date(endMs).toISOString(),
      endMs,
      packetCount,
    });
  };

  for (let index = 1; index < packets.length; index += 1) {
    const packet = packets[index];
    const gapMs = packet.timeMs - currentEnd.timeMs;

    if (gapMs > disconnectGapMs) {
      pushWindow();
      currentStart = packet;
      currentEnd = packet;
      packetCount = 1;
      continue;
    }

    currentEnd = packet;
    packetCount += 1;
  }

  pushWindow();
  return windows;
};

export const snapToPacketIndex = (
  packets: ReadonlyArray<FlightPacket>,
  targetMs: number,
): number => {
  if (packets.length === 0) {
    return -1;
  }

  if (targetMs <= packets[0].timeMs) {
    return 0;
  }

  const lastIndex = packets.length - 1;
  if (targetMs >= packets[lastIndex].timeMs) {
    return lastIndex;
  }

  let low = 0;
  let high = lastIndex;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTime = packets[mid].timeMs;

    if (midTime === targetMs) {
      return mid;
    }

    if (midTime < targetMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const left = packets[Math.max(0, high)];
  const right = packets[Math.min(lastIndex, low)];
  return Math.abs(targetMs - left.timeMs) <= Math.abs(right.timeMs - targetMs)
    ? Math.max(0, high)
    : Math.min(lastIndex, low);
};

export const snapToPacketTime = (
  packets: ReadonlyArray<FlightPacket>,
  targetMs: number,
): FlightPacket => {
  const index = snapToPacketIndex(packets, targetMs);
  return packets[Math.max(0, index)];
};

const resolveCurrentStage = (
  stages: ReadonlyArray<FlightStageWindow>,
  cursorTimeMs: number,
): string => {
  const currentStage = stages.find(
    (stage) => cursorTimeMs >= stage.startMs && cursorTimeMs <= stage.endMs,
  );

  return currentStage?.stage ?? stages[stages.length - 1]?.stage ?? "Unknown";
};

const buildInitialState = (): FlightReplayState => {
  const { parameterNames, packets } = parseTelemetryCsv(telemetryCsv);
  const gpsTrack = buildGpsTrack(packets);
  const stages = buildStageWindows(packets);
  const telemetryConnections = buildTelemetryConnectionWindows(
    packets,
    TELEMETRY_DISCONNECT_GAP_MS,
  );

  if (packets.length === 0) {
    return {
      parameterNames,
      packets: [],
      gpsTrack: [],
      stages: [],
      telemetryConnections: [],
      telemetryDisconnectGapMs: TELEMETRY_DISCONNECT_GAP_MS,
      flightStart: "",
      flightStartMs: 0,
      flightEnd: "",
      flightEndMs: 0,
      currentCursorTime: "",
      currentCursorTimeMs: 0,
      currentCursorPacketIndex: -1,
      currentPacket: undefined,
      currentFlightStage: "Unknown",
      currentGpsState: undefined,
    };
  }

  const firstPacket = packets[0];
  const lastPacket = packets[packets.length - 1];

  return {
    parameterNames,
    packets,
    gpsTrack,
    stages,
    telemetryConnections,
    telemetryDisconnectGapMs: TELEMETRY_DISCONNECT_GAP_MS,
    flightStart: firstPacket.time,
    flightStartMs: firstPacket.timeMs,
    flightEnd: lastPacket.time,
    flightEndMs: lastPacket.timeMs,
    currentCursorTime: firstPacket.time,
    currentCursorTimeMs: firstPacket.timeMs,
    currentCursorPacketIndex: 0,
    currentPacket: firstPacket,
    currentFlightStage: firstPacket.flightStage,
    currentGpsState: toGpsState(firstPacket),
  };
};

export class FlightReplay extends Context.Service<
  FlightReplay,
  {
    readonly state: SubscriptionRef.SubscriptionRef<FlightReplayState>;
    readonly setCursor: (time: Date | number | string) => Effect.Effect<void>;
    readonly getCurrentPacket: Effect.Effect<FlightPacket | undefined>;
  }
>()("@mrt/frontend/FlightReplay") {
  static readonly layer = Layer.effect(
    FlightReplay,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make(buildInitialState());

      const setCursor = (time: Date | number | string) =>
        SubscriptionRef.update(state, (current) => {
          if (current.packets.length === 0) {
            return current;
          }

          const targetMs = new Date(time).getTime();

          if (!Number.isFinite(targetMs)) {
            return current;
          }

          const nextPacket = snapToPacketTime(current.packets, targetMs);
          const nextIndex = snapToPacketIndex(current.packets, nextPacket.timeMs);

          if (nextIndex === current.currentCursorPacketIndex) {
            return current;
          }

          const nextGpsState = toGpsState(nextPacket);

          return {
            ...current,
            currentCursorTime: nextPacket.time,
            currentCursorTimeMs: nextPacket.timeMs,
            currentCursorPacketIndex: nextIndex,
            currentPacket: nextPacket,
            currentFlightStage: resolveCurrentStage(current.stages, nextPacket.timeMs),
            currentGpsState: hasSameGpsCoordinates(current.currentGpsState, nextGpsState)
              ? current.currentGpsState
              : nextGpsState,
          };
        });

      const getCurrentPacket = Effect.map(
        SubscriptionRef.get(state),
        (current) => current.currentPacket,
      );

      return { state, setCursor, getCurrentPacket };
    }),
  );
}

const flightReplayRuntime = frontendRuntimeFactory(() => FlightReplay.layer);

export const flightReplayStateAtom = flightReplayRuntime.subscriptionRef(
  FlightReplay.use((flightReplay) => Effect.succeed(flightReplay.state)),
);

export const setFlightReplayCursorAtom = flightReplayRuntime.fn<Date | number | string>()((time) =>
  FlightReplay.use((flightReplay) => flightReplay.setCursor(time)),
);

export const flightReplayCurrentPacketAtom = flightReplayRuntime.atom((get) =>
  Effect.map(get.result(flightReplayStateAtom), (flightReplay) => flightReplay.currentPacket),
);

export const flightReplayGpsStateAtom = flightReplayRuntime.atom((get) =>
  Effect.map(get.result(flightReplayStateAtom), (flightReplay) => flightReplay.currentGpsState),
);

export const flightReplayGpsPathAtom = flightReplayRuntime.atom((get) =>
  Effect.map(get.result(flightReplayStateAtom), (flightReplay) =>
    flightReplay.gpsTrack.filter(
      (point) => point.packetIndex <= flightReplay.currentCursorPacketIndex,
    ),
  ),
);
