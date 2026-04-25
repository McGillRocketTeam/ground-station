import type { ParameterValue } from "@mrt/yamcs-effect";
import type { AsyncResult } from "effect/unstable/reactivity";

import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import * as echarts from "echarts";
import { DateTime, Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import {
  parameterSubscriptionAtom,
  selectedInstanceAtom,
  YamcsAtomHttpClient,
} from "@/lib/atom";
import { makeCard } from "@/lib/cards";

const PARAMETER_NAME = "/SystemA/Rocket/FlightComputer/acceleration_x";
const MAX_POINTS = 1000;
const HISTORY_WINDOW_MS = 15 * 60 * 1000;
const SAMPLE_COUNT = 600;

type ChartPoint = [number, number];

const parameterLiveAtom = parameterSubscriptionAtom(PARAMETER_NAME);

const historyAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const instance = get(selectedInstanceAtom);
    const stop = new Date();
    const start = new Date(stop.getTime() - HISTORY_WINDOW_MS);

    const querySamples = (source: "ParameterArchive" | "replay") =>
      get.resultOnce(
        YamcsAtomHttpClient.query("parameter", "getSamples", {
          params: {
            instance,
            parameterName: PARAMETER_NAME,
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

    const archiveHistory = yield* querySamples("ParameterArchive");
    const history =
      archiveHistory.sample.length > 0
        ? archiveHistory
        : yield* querySamples("replay");

    return history.sample.flatMap((sample): ChartPoint[] =>
      sample.avg === undefined
        ? []
        : [[DateTime.toDate(sample.time).getTime(), sample.avg]],
    );
  }),
);

function extractNumericValue(parameterValue: typeof ParameterValue.Type) {
  const value =
    parameterValue.engValue && "value" in parameterValue.engValue
      ? parameterValue.engValue.value
      : parameterValue.rawValue && "value" in parameterValue.rawValue
        ? parameterValue.rawValue.value
        : undefined;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function mergePoints(points: ChartPoint[]) {
  const pointByTime = new Map<number, ChartPoint>();

  for (const point of points) {
    pointByTime.set(point[0], point);
  }

  return Array.from(pointByTime.values())
    .sort((a, b) => a[0] - b[0])
    .slice(-MAX_POINTS);
}

function updateChartData(chart: echarts.ECharts | null, points: ChartPoint[]) {
  chart?.setOption({
    series: [
      {
        data: points,
      },
    ],
  });
}

function LiveChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const pointsRef = useRef<ChartPoint[]>([]);
  const historyResult = useAtomValue(historyAtom);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    chart.setOption({
      animation: false,
      grid: {
        bottom: 32,
        left: 48,
        right: 16,
        top: 16,
      },
      xAxis: {
        type: "time",
      },
      yAxis: {
        scale: true,
        type: "value",
      },
      series: [
        {
          data: [],
          showSymbol: false,
          type: "line",
        },
      ],
      tooltip: {
        trigger: "axis",
      },
    });

    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      chartRef.current?.resize();
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (historyResult._tag !== "Success") return;

    pointsRef.current = mergePoints([
      ...historyResult.value,
      ...pointsRef.current,
    ]);
    updateChartData(chartRef.current, pointsRef.current);
  }, [historyResult]);

  const handleParameterUpdate = useCallback(
    (result: AsyncResult.AsyncResult<typeof ParameterValue.Type, unknown>) => {
      if (result._tag !== "Success") return;

      const parameterValue = result.value;
      const numericValue = extractNumericValue(parameterValue);
      if (numericValue === undefined) return;

      const point: ChartPoint = [
        DateTime.toDate(parameterValue.generationTime).getTime(),
        numericValue,
      ];

      pointsRef.current = mergePoints([...pointsRef.current, point]);
      updateChartData(chartRef.current, pointsRef.current);
    },
    [],
  );

  useAtomSubscribe(parameterLiveAtom, handleParameterUpdate);

  return <div ref={containerRef} className="h-full w-full" />;
}

export const ChartCardV2 = makeCard({
  id: "chart-v2",
  name: "Chart Card V2",
  schema: Schema.Struct({}),
  component: () => (
    <div className="relative grid h-full w-full">
      <LiveChart />
    </div>
  ),
});
