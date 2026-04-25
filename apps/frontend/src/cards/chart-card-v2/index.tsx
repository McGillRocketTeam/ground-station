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

const ACCELERATION_X = "/SystemA/Rocket/FlightComputer/acceleration_x";
const ACCELERATION_Y = "/SystemA/Rocket/FlightComputer/acceleration_y";
const MAX_POINTS = 1000;
const HISTORY_WINDOW_MS = 15 * 60 * 1000;
const SAMPLE_COUNT = 600;

type ChartPoint = [number, number];
type ChartSeriesData = {
  x: ChartPoint[];
  y: ChartPoint[];
};

type PanelApi = {
  height: number;
  width: number;
  onDidDimensionsChange: (
    listener: (event: { height: number; width: number }) => void,
  ) => { dispose: () => void };
};

const accelerationXLiveAtom = parameterSubscriptionAtom(ACCELERATION_X);
const accelerationYLiveAtom = parameterSubscriptionAtom(ACCELERATION_Y);

const historyAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const instance = get(selectedInstanceAtom);
    const stop = new Date();
    const start = new Date(stop.getTime() - HISTORY_WINDOW_MS);

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

        return history.sample.flatMap((sample): ChartPoint[] =>
          sample.avg === undefined
            ? []
            : [[DateTime.toDate(sample.time).getTime(), sample.avg]],
        );
      });

    const x = yield* getHistory(ACCELERATION_X);
    const y = yield* getHistory(ACCELERATION_Y);

    return { x, y };
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

function updateChartData(
  chart: echarts.ECharts | null,
  seriesData: ChartSeriesData,
) {
  chart?.setOption({
    series: [
      {
        data: seriesData.x,
      },
      {
        data: seriesData.y,
      },
    ],
  });
}

function resizeChart(
  chart: echarts.ECharts | null,
  size?: { height: number; width: number },
) {
  requestAnimationFrame(() => {
    if (size) {
      chart?.resize(size);
      return;
    }

    chart?.resize();
  });
}

function LiveChart({ api }: { api: PanelApi }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const pointsRef = useRef<ChartSeriesData>({ x: [], y: [] });
  const historyResult = useAtomValue(historyAtom);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    chart.setOption({
      animation: false,
      legend: {
        top: 4,
      },
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
          name: "Acceleration X",
          showSymbol: false,
          type: "line",
        },
        {
          data: [],
          name: "Acceleration Y",
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
      resizeChart(chartRef.current);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    resizeChart(chartRef.current, {
      height: api.height,
      width: api.width,
    });

    const disposable = api.onDidDimensionsChange((event) => {
      resizeChart(chartRef.current, event);
    });

    return () => {
      disposable.dispose();
    };
  }, [api]);

  useEffect(() => {
    if (historyResult._tag !== "Success") return;

    pointsRef.current = {
      x: mergePoints([...historyResult.value.x, ...pointsRef.current.x]),
      y: mergePoints([...historyResult.value.y, ...pointsRef.current.y]),
    };
    updateChartData(chartRef.current, pointsRef.current);
  }, [historyResult]);

  const handleAccelerationXUpdate = useCallback(
    (result: AsyncResult.AsyncResult<typeof ParameterValue.Type, unknown>) => {
      if (result._tag !== "Success") return;

      const parameterValue = result.value;
      const numericValue = extractNumericValue(parameterValue);
      if (numericValue === undefined) return;

      const point: ChartPoint = [
        DateTime.toDate(parameterValue.generationTime).getTime(),
        numericValue,
      ];

      pointsRef.current = {
        ...pointsRef.current,
        x: mergePoints([...pointsRef.current.x, point]),
      };
      updateChartData(chartRef.current, pointsRef.current);
    },
    [],
  );

  const handleAccelerationYUpdate = useCallback(
    (result: AsyncResult.AsyncResult<typeof ParameterValue.Type, unknown>) => {
      if (result._tag !== "Success") return;

      const parameterValue = result.value;
      const numericValue = extractNumericValue(parameterValue);
      if (numericValue === undefined) return;

      const point: ChartPoint = [
        DateTime.toDate(parameterValue.generationTime).getTime(),
        numericValue,
      ];

      pointsRef.current = {
        ...pointsRef.current,
        y: mergePoints([...pointsRef.current.y, point]),
      };
      updateChartData(chartRef.current, pointsRef.current);
    },
    [],
  );

  useAtomSubscribe(accelerationXLiveAtom, handleAccelerationXUpdate);
  useAtomSubscribe(accelerationYLiveAtom, handleAccelerationYUpdate);

  return <div ref={containerRef} className="h-full w-full" />;
}

export const ChartCardV2 = makeCard({
  id: "chart-v2",
  name: "Chart Card V2",
  schema: Schema.Struct({}),
  component: (props) => (
    <div className="relative grid h-full min-h-0 w-full min-w-0">
      <LiveChart api={props.api} />
    </div>
  ),
});
