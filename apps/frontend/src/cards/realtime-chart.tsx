import { useAtomValue } from "@effect/atom-react";
import { DateTime, Effect, Fiber, Stream } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { useEffect, useRef, useState } from "react";
import "uplot/dist/uPlot.min.css";
import uPlot, { type AlignedData } from "uplot";

import {
  logValidationFailure,
  parameterSubscriptionAtom,
  selectedInstanceAtom,
  themeAtom,
  YamcsAtomHttpClient,
} from "@/lib/atom";
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
const INITIAL_SAMPLE_COUNT = 240;

type RealtimePlotThemeColors = {
  border: string;
  muted: string;
};

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

function getRealtimePlotThemeColors(container: HTMLElement): RealtimePlotThemeColors {
  const styles = getComputedStyle(container);

  return {
    border: styles.getPropertyValue("--border").trim(),
    muted: styles.getPropertyValue("--muted-foreground").trim(),
  };
}

function makeAxisOptions(colors: RealtimePlotThemeColors): uPlot.Axis[] {
  return [
    {
      border: { stroke: colors.border },
      grid: { stroke: colors.border },
      stroke: colors.muted,
      ticks: { stroke: colors.border },
    },
    {
      border: { stroke: colors.border },
      grid: { stroke: colors.border },
      stroke: colors.muted,
      ticks: { stroke: colors.border },
    },
  ];
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
): AlignedData {
  const timestamps = new Set<number>([cutoff]);

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

function getLatestLegendIndex(data: AlignedData) {
  return data[0].length > 1 ? data[0].length - 1 : undefined;
}

export function RealtimePlot({
  className,
  seriesConfigs,
}: {
  className?: string;
  seriesConfigs: ReadonlyArray<ChartSeriesConfig>;
}) {
  const instance = useAtomValue(selectedInstanceAtom);
  const theme = useAtomValue(themeAtom);
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(media.matches ? "dark" : "light");
    };

    handleChange();
    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [theme]);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setThemeRefreshKey((value) => value + 1);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [resolvedTheme]);

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
    let themeColors = getRealtimePlotThemeColors(containerRef.current);
    const plot = new uPlot(
      {
        ...initialSize,
        axes: makeAxisOptions(themeColors),
        hooks: {
          setCursor: [
            (self) => {
              if (self.cursor.idx == null) {
                self.setLegend({ idx: getLatestLegendIndex(self.data) });
              }
            },
          ],
        },
        series: makeSeriesOptions(seriesConfigs),
      },
      data,
      chartRef.current,
    );
    const buffers = new Map<string, Array<readonly [timestamp: number, value: number]>>(
      seriesConfigs.map((series) => [series.parameter, []]),
    );
    let frameId: number | undefined;
    let dirty = false;
    let latestLegendIndex: number | undefined;
    const seedFiber = Effect.runFork(
      Effect.gen(function* () {
        const stop = new Date();
        const start = new Date(stop.getTime() - BUFFER_WINDOW_SECONDS * 1000);

        const querySamples = (parameterName: string, source: "ParameterArchive" | "replay") =>
          Effect.orElseSucceed(
            Effect.tapError(
              AtomRegistry.getResult(
                atomRegistry,
                YamcsAtomHttpClient.query("parameter", "getSamples", {
                  params: {
                    instance,
                    parameterName,
                  },
                  query: {
                    count: INITIAL_SAMPLE_COUNT,
                    gapTime: 300000,
                    source,
                    start: start.toISOString(),
                    stop: stop.toISOString(),
                    useRawValue: false,
                  },
                }),
              ),
              (error) =>
                logValidationFailure(`realtime seed query (${instance}, ${parameterName})`, error, {
                  instance,
                  parameterName,
                  source,
                  start,
                  stop,
                }),
            ),
            () => ({ sample: [] as const }),
          );

        const seededSamples = yield* Effect.all(
          seriesConfigs.map((series) =>
            Effect.gen(function* () {
              const archiveHistory = yield* querySamples(series.parameter, "ParameterArchive");
              const history =
                archiveHistory.sample.length > 0
                  ? archiveHistory
                  : yield* querySamples(series.parameter, "replay");

              return {
                parameter: series.parameter,
                samples: history.sample.flatMap((sample) => {
                  if (sample.avg === undefined) {
                    return [];
                  }

                  return [
                    [
                      DateTime.toDate(sample.time).getTime() / 1000,
                      applySeriesOffset(sample.avg, series),
                    ] as const,
                  ];
                }),
              };
            }),
          ),
        );

        yield* Effect.sync(() => {
          for (const { parameter, samples } of seededSamples) {
            const buffer = buffers.get(parameter);
            if (!buffer || samples.length === 0) {
              continue;
            }

            buffer.push(...samples);
            buffer.sort((a, b) => a[0] - b[0]);
          }

          dirty = true;
        });
      }),
    );
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
        const alignedData = buildAlignedData(seriesConfigs, buffers, cutoff);
        latestLegendIndex = getLatestLegendIndex(alignedData);

        plot.setData(alignedData);

        if (plot.cursor.idx == null) {
          plot.setLegend({ idx: latestLegendIndex });
        }
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
      Effect.runFork(Fiber.interrupt(seedFiber));
      plot.destroy();
      for (const fiber of subscriptionFibers) {
        Effect.runFork(Fiber.interrupt(fiber));
      }
    };
  }, [instance, seriesConfigs, themeRefreshKey]);

  return (
    <div className="col-span-full h-full w-full pb-8">
      <div className={cn("h-full w-full", className)} ref={containerRef}>
        <div ref={chartRef} />
      </div>
    </div>
  );
}
