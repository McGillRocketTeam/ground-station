import type { ParameterValue } from "@mrt/yamcs-effect";
import type { AsyncResult } from "effect/unstable/reactivity";

import { useAtomSubscribe } from "@effect/atom-react";
import * as echarts from "echarts";
import { DateTime, Schema } from "effect";
import { useCallback, useLayoutEffect, useRef } from "react";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

const PARAMETER_NAME = "/SystemA/Rocket/FlightComputer/acceleration_x";
const MAX_POINTS = 1000;

type ChartPoint = [number, number];

const parameterLiveAtom = parameterSubscriptionAtom(PARAMETER_NAME);

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

function LiveChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const pointsRef = useRef<ChartPoint[]>([]);

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

      pointsRef.current = [...pointsRef.current, point].slice(-MAX_POINTS);

      chartRef.current?.setOption({
        series: [
          {
            data: pointsRef.current,
          },
        ],
      });
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
