import { Effect, Fiber, Stream } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { useEffect, useRef } from "react";
import "uplot/dist/uPlot.min.css";
import uPlot, { type AlignedData } from "uplot";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { atomRegistry } from "@/lib/atom-registry";
import { makeCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

import {
  ChartCardConfigSchema,
  DEFAULT_SERIES_CONFIGS,
  type ChartSeriesConfig,
} from "./chart-card/config";
import { applySeriesOffset } from "./chart-card/data";

export const RealtimeChartCard = makeCard({
  id: "realtime-chart-card",
  name: "Realtime Chart",
  schema: ChartCardConfigSchema,
  component: (props) => (
    <RealtimePlot seriesConfigs={props.params.series ?? DEFAULT_SERIES_CONFIGS} />
  ),
});

const DEFAULT_CHART_WIDTH = 620;
const DEFAULT_CHART_HEIGHT = 480;

const BUFFER_WINDOW_SECONDS = 30;

function extractNumericValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function getParameterNumericValue(update: {
  readonly value: {
    readonly engValue?: unknown;
    readonly rawValue?: unknown;
  };
}) {
  const engValue = update.value.engValue;
  if (engValue && typeof engValue === "object" && "value" in engValue) {
    return extractNumericValue(engValue.value);
  }

  const rawValue = update.value.rawValue;
  if (rawValue && typeof rawValue === "object" && "value" in rawValue) {
    return extractNumericValue(rawValue.value);
  }

  return undefined;
}

function withAlpha(color: string, alphaHex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : color;
}

function makeSeriesOptions(seriesConfigs: ReadonlyArray<ChartSeriesConfig>): uPlot.Series[] {
  return [
    {},
    ...seriesConfigs.map((series) => ({
      label: series.label,
      spanGaps: false,
      stroke: series.color,
      width: 2,
      fill: withAlpha(series.color, "1f"),
      value: (_: uPlot, rawValue: number | null) => (rawValue == null ? "" : rawValue.toFixed(2)),
    })),
  ];
}

function buildAlignedData(
  seriesConfigs: ReadonlyArray<ChartSeriesConfig>,
  buffers: Map<string, Array<readonly [timestamp: number, value: number]>>,
  cutoff: number,
  frameNow: number,
): AlignedData {
  const timestamps = new Set<number>([cutoff, frameNow]);

  for (const series of seriesConfigs) {
    const buffer = buffers.get(series.parameter) ?? [];
    for (const [timestamp] of buffer) {
      timestamps.add(timestamp);
    }
  }

  const xs = Array.from(timestamps).sort((a, b) => a - b);
  const aligned: AlignedData = [xs];

  for (const series of seriesConfigs) {
    const valuesByTimestamp = new Map(buffers.get(series.parameter) ?? []);
    aligned.push(xs.map((timestamp) => valuesByTimestamp.get(timestamp) ?? null));
  }

  return aligned;
}

export function RealtimePlot({
  className,
  seriesConfigs,
}: {
  className?: string;
  seriesConfigs: ReadonlyArray<ChartSeriesConfig>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = Date.now() / 1000;
    const data: AlignedData = [[now - 1, now], ...seriesConfigs.map(() => [null, null])];

    if (!containerRef.current || !chartRef.current) {
      return;
    }

    const measureSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      return {
        width: Math.max(100, Math.floor(rect?.width ?? DEFAULT_CHART_WIDTH)),
        height: Math.max(100, Math.floor(rect?.height ?? DEFAULT_CHART_HEIGHT)),
      };
    };

    const initialSize = measureSize();
    const plot = new uPlot(
      { ...initialSize, series: makeSeriesOptions(seriesConfigs) },
      data,
      chartRef.current,
    );
    const buffers = new Map<string, Array<readonly [timestamp: number, value: number]>>(
      seriesConfigs.map((series) => [series.parameter, []]),
    );
    let frameId: number | undefined;
    let dirty = false;
    const resizeObserver = new ResizeObserver(() => {
      plot.setSize(measureSize());
    });

    resizeObserver.observe(containerRef.current);

    const renderFrame = () => {
      const frameNow = Date.now() / 1000;
      const cutoff = frameNow - BUFFER_WINDOW_SECONDS;
      let trimmed = false;

      for (const buffer of buffers.values()) {
        while (buffer.length > 0 && buffer[0]![0] < cutoff) {
          buffer.shift();
          trimmed = true;
        }
      }

      if (dirty || trimmed) {
        dirty = false;
        plot.setData(buildAlignedData(seriesConfigs, buffers, cutoff, frameNow));
      }

      plot.setScale("x", { min: cutoff, max: frameNow });
      frameId = requestAnimationFrame(renderFrame);
    };

    frameId = requestAnimationFrame(renderFrame);

    const subscriptionFibers = seriesConfigs.map((series) =>
      Effect.runFork(
        Effect.scoped(
          AtomRegistry.toStreamResult(
            atomRegistry,
            parameterSubscriptionAtom(series.parameter),
          ).pipe(
            Stream.runForEach((update) =>
              Effect.sync(() => {
                const numericValue = getParameterNumericValue(update);

                if (numericValue === undefined) {
                  return;
                }

                const timestamp = Date.now() / 1000;
                const buffer = buffers.get(series.parameter);

                if (!buffer) {
                  return;
                }

                buffer.push([timestamp, applySeriesOffset(numericValue, series)]);
                dirty = true;
              }),
            ),
          ),
        ),
      ),
    );

    return () => {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      plot.destroy();
      for (const fiber of subscriptionFibers) {
        Effect.runFork(Fiber.interrupt(fiber));
      }
    };
  }, [seriesConfigs]);

  return (
    <div className={cn("h-full w-full", className)} ref={containerRef}>
      <div ref={chartRef} />
    </div>
  );
}
