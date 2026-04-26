import type { ParameterValue } from "@mrt/yamcs-effect";

import { DateTime, Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import {
  parameterSubscriptionAtom,
  selectedInstanceAtom,
  YamcsAtomHttpClient,
} from "@/lib/atom";

import type { ChartPoint, ChartViewport } from "./types";

import { DEFAULT_SERIES_CONFIGS } from "./config";

export const MAX_POINTS = 1000;
export const LIVE_WINDOW_MS = 15 * 60 * 1000;

const SAMPLE_COUNT = 5200;

const accelerationXSeries = DEFAULT_SERIES_CONFIGS[0]!;
const accelerationYSeries = DEFAULT_SERIES_CONFIGS[1]!;

export const accelerationXLiveAtom = parameterSubscriptionAtom(
  accelerationXSeries.parameter,
);
export const accelerationYLiveAtom = parameterSubscriptionAtom(
  accelerationYSeries.parameter,
);

export const viewportAtom = Atom.make<ChartViewport>({
  end: Date.now(),
  mode: "live",
  start: Date.now() - LIVE_WINDOW_MS,
});

export const historyAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const instance = get(selectedInstanceAtom);
    const viewport = get(viewportAtom);
    const samplePaddingMs = Math.max(
      1,
      (viewport.end - viewport.start) / SAMPLE_COUNT,
    );
    const stop = new Date(viewport.end + samplePaddingMs);
    const start = new Date(viewport.start - samplePaddingMs);

    const querySamples = (
      parameterName: string,
      source: "ParameterArchive" | "replay",
    ) =>
      get.resultOnce(
        YamcsAtomHttpClient.query("parameter", "getSamples", {
          params: {
            instance,
            parameterName,
          },
          query: {
            count: SAMPLE_COUNT,
            gapTime: 300000,
            source,
            start: start.toISOString(),
            stop: stop.toISOString(),
            useRawValue: false,
          },
        }),
      );

    const getHistory = (parameterName: string) =>
      Effect.gen(function* () {
        const archiveHistory = yield* querySamples(
          parameterName,
          "ParameterArchive",
        );
        const history =
          archiveHistory.sample.length > 0
            ? archiveHistory
            : yield* querySamples(parameterName, "replay");

        return history.sample.flatMap((sample): ChartPoint[] => {
          if (sample.avg === undefined) return [];

          return [
            {
              avg: sample.avg,
              max: sample.max ?? sample.avg,
              min: sample.min ?? sample.avg,
              time: DateTime.toDate(sample.time).getTime(),
            },
          ];
        });
      });

    const x = yield* getHistory(accelerationXSeries.parameter);
    const y = yield* getHistory(accelerationYSeries.parameter);

    return { x, y };
  }),
);

export function extractNumericValue(
  parameterValue: typeof ParameterValue.Type,
) {
  const value =
    parameterValue.engValue && "value" in parameterValue.engValue
      ? parameterValue.engValue.value
      : parameterValue.rawValue && "value" in parameterValue.rawValue
        ? parameterValue.rawValue.value
        : undefined;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

export function mergePoints(points: ChartPoint[]) {
  const pointByTime = new Map<number, ChartPoint>();

  for (const point of points) {
    pointByTime.set(point.time, point);
  }

  return Array.from(pointByTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-MAX_POINTS);
}
