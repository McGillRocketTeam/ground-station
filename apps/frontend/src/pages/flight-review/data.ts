import { Context, DateTime, Effect, Layer, Schema, SubscriptionRef } from "effect";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

export const FLIGHT_STAGE_PARAMETER = "/SystemA/Rocket/FlightComputer/flight_stage";
export const ALTITUDE_PARAMETER = "/SystemA/Rocket/FlightComputer/barometer_altitude_from_pad";
export const VERTICAL_SPEED_PARAMETER = "/SystemA/Rocket/FlightComputer/vertical_speed";
export const APOGEE_PARAMETER = "/SystemA/Rocket/FlightComputer/apogee_from_ground";
const GPS_ALTITUDE_PARAMETER = "/SystemA/Rocket/FlightComputer/gps_altitude";
const GPS_LATITUDE_PARAMETER = "/SystemA/Rocket/FlightComputer/gps_latitude";
const GPS_LONGITUDE_PARAMETER = "/SystemA/Rocket/FlightComputer/gps_longitude";
const TELEMETRY_DISCONNECT_GAP_MS = 2000;
const SAMPLE_COUNT = 10_000;
const FLIGHT_DISCOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

const SYSTEM_A_PARAMETERS = [
  FLIGHT_STAGE_PARAMETER,
  ALTITUDE_PARAMETER,
  VERTICAL_SPEED_PARAMETER,
  APOGEE_PARAMETER,
  GPS_ALTITUDE_PARAMETER,
  GPS_LATITUDE_PARAMETER,
  GPS_LONGITUDE_PARAMETER,
  "/SystemA/Rocket/FlightComputer/gps_fix_ok",
  "/SystemA/Rocket/FlightComputer/gps_fix_type",
  "/SystemA/Rocket/FlightComputer/gps_horizontal_accuracy",
  "/SystemA/Rocket/FlightComputer/gps_vertical_accuracy",
  "/SystemA/Rocket/FlightComputer/drouge_deployment_from_ground",
  "/SystemA/Rocket/FlightComputer/drogue_armed_HW",
  "/SystemA/Rocket/FlightComputer/drogue_armed_SW",
  "/SystemA/Rocket/FlightComputer/drogue_continuity_HW",
  "/SystemA/Rocket/FlightComputer/drogue_energized_SW",
  "/SystemA/Rocket/FlightComputer/drogue_energizedGate_HW",
  "/SystemA/Rocket/FlightComputer/drogue_energizedCurrent_HW",
  "/SystemA/Rocket/FlightComputer/main_deployment_from_ground",
  "/SystemA/Rocket/FlightComputer/main_armed_HW",
  "/SystemA/Rocket/FlightComputer/main_armed_SW",
  "/SystemA/Rocket/FlightComputer/main_continuity_HW",
  "/SystemA/Rocket/FlightComputer/main_energized_SW",
  "/SystemA/Rocket/FlightComputer/main_energizedGate_HW",
  "/SystemA/Rocket/FlightComputer/main_energizedCurrent_HW",
  "/SystemA/Rocket/FlightComputer/predicted_location_latitude",
  "/SystemA/Rocket/FlightComputer/predicted_location_longitude",
  "/SystemA/Rocket/FlightComputer/predicted_location_accuracy",
] as const;

const SYSTEM_B_PARAMETERS = SYSTEM_A_PARAMETERS.map((parameter) =>
  parameter.replace("/SystemA/", "/SystemB/"),
);

export const FLIGHT_REPLAY_PARAMETERS = [...SYSTEM_A_PARAMETERS, ...SYSTEM_B_PARAMETERS];

const RAW_SAMPLE_PARAMETER_SUFFIXES = [
  "/flight_stage",
  "/gps_fix_ok",
  "_armed_HW",
  "_armed_SW",
  "_continuity_HW",
  "_energized_SW",
  "_energizedGate_HW",
  "_energizedCurrent_HW",
] as const;

const usesRawSamples = (parameterName: string) =>
  RAW_SAMPLE_PARAMETER_SUFFIXES.some((suffix) => parameterName.endsWith(suffix));

const FLIGHT_STAGE_LABELS: Readonly<Record<number, string>> = {
  0: "Pad",
  1: "Ascent",
  2: "Pre-Apogee",
  3: "Drogue descent",
  4: "Main descent",
  5: "Landed",
  99: "Pre-Pad, error in initialization",
};

export const flightStageLabel = (value: string | undefined) => {
  const numericValue = toOptionalNumber(value);
  return numericValue === undefined
    ? "Unknown"
    : (FLIGHT_STAGE_LABELS[Math.round(numericValue)] ?? String(numericValue));
};

export type FlightReplayRange = {
  readonly start: string;
  readonly stop: string;
};

type FlightStageSample = {
  readonly timeMs: number;
  readonly stage: number;
};

class InvalidFlightReplayRange extends Schema.TaggedErrorClass<InvalidFlightReplayRange>()(
  "FlightReplay.InvalidRange",
  { message: Schema.String },
) {}

type ParameterSeries = {
  readonly parameterName: string;
  readonly samples: ReadonlyArray<{ readonly timeMs: number; readonly value: number }>;
};

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

export type RecoveryEvent = {
  readonly id: string;
  readonly label: string;
  readonly time: string;
  readonly timeMs: number;
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
  readonly range?: FlightReplayRange;
  readonly parameterNames: ReadonlyArray<string>;
  readonly packets: ReadonlyArray<FlightPacket>;
  readonly gpsTrack: ReadonlyArray<FlightReplayGpsTrackPoint>;
  readonly stages: ReadonlyArray<FlightStageWindow>;
  readonly telemetryConnections: ReadonlyArray<TelemetryConnectionWindow>;
  readonly recoveryEvents: ReadonlyArray<RecoveryEvent>;
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

const toOptionalNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const toGpsState = (packet: FlightPacket | undefined): FlightReplayGpsState | undefined => {
  if (!packet) return undefined;

  const latitude = toOptionalNumber(packet.parameters[GPS_LATITUDE_PARAMETER]);
  const longitude = toOptionalNumber(packet.parameters[GPS_LONGITUDE_PARAMETER]);
  if (latitude === undefined || longitude === undefined) return undefined;

  return {
    latitude,
    longitude,
    altitude: toOptionalNumber(packet.parameters[GPS_ALTITUDE_PARAMETER]),
    packetTime: packet.time,
  };
};

const hasSameGpsCoordinates = (
  left: FlightReplayGpsState | undefined,
  right: FlightReplayGpsState | undefined,
) => left?.latitude === right?.latitude && left?.longitude === right?.longitude;

const buildGpsTrack = (packets: ReadonlyArray<FlightPacket>) => {
  const track: Array<FlightReplayGpsTrackPoint> = [];
  let previousPoint: FlightReplayGpsState | undefined;

  for (const [packetIndex, packet] of packets.entries()) {
    const gpsState = toGpsState(packet);
    if (!gpsState || hasSameGpsCoordinates(previousPoint, gpsState)) continue;
    track.push({ ...gpsState, packetIndex, flightStage: packet.flightStage });
    previousPoint = gpsState;
  }

  return track;
};

const buildPackets = (series: ReadonlyArray<ParameterSeries>): ReadonlyArray<FlightPacket> => {
  const samplesByTime = new Map<number, Map<string, number>>();

  for (const parameterSeries of series) {
    for (const sample of parameterSeries.samples) {
      const values = samplesByTime.get(sample.timeMs) ?? new Map<string, number>();
      values.set(parameterSeries.parameterName, sample.value);
      samplesByTime.set(sample.timeMs, values);
    }
  }

  const previousValues = new Map<string, string>();
  return Array.from(samplesByTime.entries())
    .sort(([left], [right]) => left - right)
    .map(([timeMs, values]) => {
      for (const [parameterName, value] of values) {
        previousValues.set(parameterName, String(value));
      }

      const flightStage = flightStageLabel(previousValues.get(FLIGHT_STAGE_PARAMETER));

      return {
        time: new Date(timeMs).toISOString(),
        timeMs,
        flightStage,
        parameters: Object.fromEntries(
          FLIGHT_REPLAY_PARAMETERS.map((parameterName) => [
            parameterName,
            previousValues.get(parameterName),
          ]),
        ),
      };
    });
};

export const findCompletedFlightRanges = (
  samples: ReadonlyArray<FlightStageSample>,
): ReadonlyArray<FlightReplayRange> => {
  const ranges: Array<FlightReplayRange> = [];
  let previousSample: FlightStageSample | undefined;
  let flightStartMs: number | undefined;

  for (const sample of [...samples].sort((left, right) => left.timeMs - right.timeMs)) {
    const stage = Math.round(sample.stage);
    if (previousSample && Math.round(previousSample.stage) === 1 && stage === 2) {
      flightStartMs = previousSample.timeMs;
    } else if (
      flightStartMs !== undefined &&
      (stage === 5 ||
        ((stage === 0 || stage === 99) && Math.round(previousSample?.stage ?? stage) !== stage))
    ) {
      ranges.push({
        start: new Date(flightStartMs).toISOString(),
        stop: new Date(sample.timeMs).toISOString(),
      });
      flightStartMs = undefined;
    }
    previousSample = sample;
  }

  if (flightStartMs !== undefined && previousSample && previousSample.timeMs > flightStartMs) {
    ranges.push({
      start: new Date(flightStartMs).toISOString(),
      stop: new Date(previousSample.timeMs).toISOString(),
    });
  }

  return ranges.reverse();
};

const buildStageWindows = (packets: ReadonlyArray<FlightPacket>) => {
  if (packets.length === 0) return [];

  const windows: Array<FlightStageWindow> = [];
  let currentStage = packets[0].flightStage;
  let currentStart = packets[0];

  for (let index = 1; index < packets.length; index += 1) {
    const packet = packets[index];
    if (packet.flightStage === currentStage) continue;

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
) => {
  if (packets.length === 0) return [];

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
    if (packet.timeMs - currentEnd.timeMs > disconnectGapMs) {
      pushWindow();
      currentStart = packet;
      currentEnd = packet;
      packetCount = 1;
    } else {
      currentEnd = packet;
      packetCount += 1;
    }
  }

  pushWindow();
  return windows;
};

const buildRecoveryEvents = (packets: ReadonlyArray<FlightPacket>) => {
  const definitions = [
    ["A", "Drogue command", "/SystemA/Rocket/FlightComputer/drogue_energized_SW"],
    ["A", "Drogue gate", "/SystemA/Rocket/FlightComputer/drogue_energizedGate_HW"],
    ["A", "Drogue current", "/SystemA/Rocket/FlightComputer/drogue_energizedCurrent_HW"],
    ["A", "Main command", "/SystemA/Rocket/FlightComputer/main_energized_SW"],
    ["A", "Main gate", "/SystemA/Rocket/FlightComputer/main_energizedGate_HW"],
    ["A", "Main current", "/SystemA/Rocket/FlightComputer/main_energizedCurrent_HW"],
    ["B", "Drogue command", "/SystemB/Rocket/FlightComputer/drogue_energized_SW"],
    ["B", "Drogue gate", "/SystemB/Rocket/FlightComputer/drogue_energizedGate_HW"],
    ["B", "Drogue current", "/SystemB/Rocket/FlightComputer/drogue_energizedCurrent_HW"],
    ["B", "Main command", "/SystemB/Rocket/FlightComputer/main_energized_SW"],
    ["B", "Main gate", "/SystemB/Rocket/FlightComputer/main_energizedGate_HW"],
    ["B", "Main current", "/SystemB/Rocket/FlightComputer/main_energizedCurrent_HW"],
  ] as const;

  return definitions.flatMap(([system, label, parameterName]) => {
    const packet = packets.find(
      (candidate) => (toOptionalNumber(candidate.parameters[parameterName]) ?? 0) > 0.5,
    );
    return packet
      ? [
          {
            id: `recovery-${system}-${parameterName}`,
            label: `${system} ${label}`,
            time: packet.time,
            timeMs: packet.timeMs,
          },
        ]
      : [];
  });
};

export const snapToPacketIndex = (
  packets: ReadonlyArray<FlightPacket>,
  targetMs: number,
): number => {
  if (packets.length === 0) return -1;
  if (targetMs <= packets[0].timeMs) return 0;

  const lastIndex = packets.length - 1;
  if (targetMs >= packets[lastIndex].timeMs) return lastIndex;

  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTime = packets[mid].timeMs;
    if (midTime === targetMs) return mid;
    if (midTime < targetMs) low = mid + 1;
    else high = mid - 1;
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
): FlightPacket => packets[Math.max(0, snapToPacketIndex(packets, targetMs))];

const emptyState = (): FlightReplayState => ({
  parameterNames: FLIGHT_REPLAY_PARAMETERS,
  packets: [],
  gpsTrack: [],
  stages: [],
  telemetryConnections: [],
  recoveryEvents: [],
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
});

const buildState = (range: FlightReplayRange, series: ReadonlyArray<ParameterSeries>) => {
  const packets = buildPackets(series);
  if (packets.length === 0) return { ...emptyState(), range };

  const firstPacket = packets[0];
  const lastPacket = packets[packets.length - 1];
  return {
    range,
    parameterNames: FLIGHT_REPLAY_PARAMETERS,
    packets,
    gpsTrack: buildGpsTrack(packets),
    stages: buildStageWindows(packets),
    telemetryConnections: buildTelemetryConnectionWindows(packets, TELEMETRY_DISCONNECT_GAP_MS),
    recoveryEvents: buildRecoveryEvents(packets),
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
  } satisfies FlightReplayState;
};

export class FlightReplay extends Context.Service<
  FlightReplay,
  {
    readonly state: SubscriptionRef.SubscriptionRef<FlightReplayState>;
    readonly load: (
      range: FlightReplayRange,
      series: ReadonlyArray<ParameterSeries>,
    ) => Effect.Effect<void>;
    readonly setCursor: (time: Date | number | string) => Effect.Effect<void>;
  }
>()("@mrt/frontend/FlightReplay") {
  static readonly layer = Layer.effect(
    FlightReplay,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make(emptyState());

      const load = Effect.fn("FlightReplay.load")(function* (
        range: FlightReplayRange,
        series: ReadonlyArray<ParameterSeries>,
      ) {
        yield* SubscriptionRef.set(state, buildState(range, series));
      });

      const setCursor = Effect.fn("FlightReplay.setCursor")(function* (
        time: Date | number | string,
      ) {
        yield* SubscriptionRef.update(state, (current) => {
          if (current.packets.length === 0) return current;
          const targetMs = new Date(time).getTime();
          if (!Number.isFinite(targetMs)) return current;

          const nextIndex = snapToPacketIndex(current.packets, targetMs);
          if (nextIndex === current.currentCursorPacketIndex) return current;
          const nextPacket = current.packets[nextIndex];
          const nextGpsState = toGpsState(nextPacket);

          return {
            ...current,
            currentCursorTime: nextPacket.time,
            currentCursorTimeMs: nextPacket.timeMs,
            currentCursorPacketIndex: nextIndex,
            currentPacket: nextPacket,
            currentFlightStage: nextPacket.flightStage,
            currentGpsState: hasSameGpsCoordinates(current.currentGpsState, nextGpsState)
              ? current.currentGpsState
              : nextGpsState,
          };
        });
      });

      return FlightReplay.of({ state, load, setCursor });
    }),
  );
}

const flightReplayRuntime = YamcsAtomHttpClient.runtime.factory((get) =>
  Layer.merge(FlightReplay.layer, get(YamcsAtomHttpClient.runtime.layer)),
);

export const flightReplayStateAtom = flightReplayRuntime.subscriptionRef(
  FlightReplay.use((flightReplay) => Effect.succeed(flightReplay.state)),
);

export const suggestedFlightRangesAtom = YamcsAtomHttpClient.runtime.atom((get) =>
  Effect.gen(function* () {
    const instance = get(selectedInstanceAtom);
    if (!instance) return [];

    const stop = Date.now();
    const start = stop - FLIGHT_DISCOVERY_WINDOW_MS;
    const query = (source: "ParameterArchive" | "replay") =>
      YamcsAtomHttpClient.use((client) =>
        client.parameter.getSamples({
          params: { instance, parameterName: FLIGHT_STAGE_PARAMETER },
          query: {
            count: SAMPLE_COUNT,
            source,
            start: new Date(start).toISOString(),
            stop: new Date(stop).toISOString(),
            useRawValue: true,
          },
        }),
      );

    const archive = yield* query("ParameterArchive");
    const response = archive.sample.length > 0 ? archive : yield* query("replay");
    return findCompletedFlightRanges(
      response.sample.flatMap((sample) =>
        sample.avg === undefined || !Number.isFinite(sample.avg) || sample.n === 0
          ? []
          : [
              {
                timeMs: DateTime.toDate(sample.firstTime ?? sample.time).getTime(),
                stage: sample.avg,
              },
            ],
      ),
    );
  }),
);

export const loadFlightReplayAtom = flightReplayRuntime.fn<FlightReplayRange>()((range, get) =>
  Effect.gen(function* () {
    const instance = get(selectedInstanceAtom);
    const startMs = new Date(range.start).getTime();
    const stopMs = new Date(range.stop).getTime();
    if (!instance) {
      return yield* new InvalidFlightReplayRange({ message: "Select a Yamcs instance first" });
    }
    if (!Number.isFinite(startMs) || !Number.isFinite(stopMs) || startMs >= stopMs) {
      return yield* new InvalidFlightReplayRange({
        message: "The start time must be before the stop time",
      });
    }

    const loadParameter = Effect.fn("FlightReplay.loadParameter")(function* (
      parameterName: string,
    ) {
      const query = (source: "ParameterArchive" | "replay") =>
        YamcsAtomHttpClient.use((client) =>
          client.parameter.getSamples({
            params: { instance, parameterName },
            query: {
              count: SAMPLE_COUNT,
              gapTime: TELEMETRY_DISCONNECT_GAP_MS,
              source,
              start: new Date(startMs).toISOString(),
              stop: new Date(stopMs).toISOString(),
              useRawValue: usesRawSamples(parameterName),
            },
          }),
        );

      const archive = yield* query("ParameterArchive");
      const response = archive.sample.length > 0 ? archive : yield* query("replay");
      return {
        parameterName,
        samples: response.sample.flatMap((sample) =>
          sample.avg === undefined || !Number.isFinite(sample.avg) || sample.n === 0
            ? []
            : [{ timeMs: DateTime.toDate(sample.time).getTime(), value: sample.avg }],
        ),
      } satisfies ParameterSeries;
    });

    const series = yield* Effect.all(FLIGHT_REPLAY_PARAMETERS.map(loadParameter), {
      concurrency: "unbounded",
    });
    yield* FlightReplay.use((flightReplay) => flightReplay.load(range, series));
  }),
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
