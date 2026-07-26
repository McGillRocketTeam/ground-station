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
  DEFAULT_SERIES_CONFIGS,
  RealtimeChartCardConfigSchema,
  type ChartSeriesConfig,
} from "./chart-card/config";
import { applySeriesOffset } from "./chart-card/data";

export const RealtimeChartCard = makeCard({
  id: "realtime-chart-card",
  name: "Realtime Chart",
  schema: RealtimeChartCardConfigSchema,
  component: (props) => (
    <RealtimePlot
      panelApi={props.api}
      seriesConfigs={props.params.series ?? DEFAULT_SERIES_CONFIGS}
      showAlarmLines={props.params.showAlarmLines ?? true}
      timeWindowSeconds={(props.params.defaultTimeWindowMinutes ?? 0.5) * 60}
    />
  ),
});

const DEFAULT_CHART_WIDTH = 620;
const DEFAULT_CHART_HEIGHT = 480;

const INITIAL_SAMPLE_COUNT = 240;

type RealtimePlotThemeColors = {
  border: string;
  muted: string;
};

type RealtimePlotPanelApi = {
  readonly isVisible: boolean;
  readonly onDidVisibilityChange: (listener: (event: { readonly isVisible: boolean }) => void) => {
    dispose: () => void;
  };
};

type AlarmLine = {
  color: string;
  label: string;
  value: number;
};

type StaticAlarmRange = {
  readonly level: string;
  readonly minInclusive?: number;
  readonly minExclusive?: number;
  readonly maxInclusive?: number;
  readonly maxExclusive?: number;
};

const ALARM_COLORS: Readonly<Record<string, string>> = {
  WATCH: "#facc15",
  WARNING: "#f59e0b",
  DISTRESS: "#f97316",
  CRITICAL: "#ef4444",
  SEVERE: "#dc2626",
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

function getAlarmLines(
  ranges: ReadonlyArray<StaticAlarmRange>,
  series: ChartSeriesConfig,
): Array<AlarmLine> {
  return ranges.flatMap((range) => {
    const color = ALARM_COLORS[range.level] ?? "#ef4444";
    const normalizedLevel = range.level.toLowerCase();
    const level = normalizedLevel.charAt(0).toUpperCase() + normalizedLevel.slice(1);
    const min = range.minInclusive ?? range.minExclusive;
    const max = range.maxInclusive ?? range.maxExclusive;

    return [
      ...(min === undefined
        ? []
        : [{ color, label: `${level} low`, value: applySeriesOffset(min, series) }]),
      ...(max === undefined
        ? []
        : [{ color, label: `${level} high`, value: applySeriesOffset(max, series) }]),
    ];
  });
}

function alarmLinesPlugin(getLines: () => ReadonlyArray<AlarmLine>): uPlot.Plugin {
  return {
    hooks: {
      draw: [
        (plot) => {
          const { ctx } = plot;
          const { left, top, width, height } = plot.bbox;
          const pixelRatio = devicePixelRatio;

          ctx.save();
          ctx.beginPath();
          ctx.rect(left, top, width, height);
          ctx.clip();
          ctx.font = `${11 * pixelRatio}px sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";

          for (const line of getLines()) {
            const y = Math.round(plot.valToPos(line.value, "y", true));
            if (y < top || y > top + height) {
              continue;
            }

            const valueLabel = line.value.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            });
            const label = `${valueLabel}  ${line.label}`;

            ctx.strokeStyle = line.color;
            ctx.lineWidth = pixelRatio;
            ctx.setLineDash([6 * pixelRatio, 4 * pixelRatio]);
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(left + width, y);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.fillStyle = line.color;
            ctx.fillText(label, left + 6 * pixelRatio, y - 4 * pixelRatio);
          }

          ctx.restore();
        },
      ],
    },
  };
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
  panelApi,
  seriesConfigs,
  showAlarmLines = true,
  timeWindowSeconds = 30,
}: {
  className?: string;
  panelApi?: RealtimePlotPanelApi;
  seriesConfigs: ReadonlyArray<ChartSeriesConfig>;
  showAlarmLines?: boolean;
  timeWindowSeconds?: number;
}) {
  const instance = useAtomValue(selectedInstanceAtom);
  const theme = useAtomValue(themeAtom);
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);
  const [isVisible, setIsVisible] = useState(() => panelApi?.isVisible ?? true);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelApi) {
      return;
    }

    setIsVisible(panelApi.isVisible);
    const disposable = panelApi.onDidVisibilityChange((event) => {
      setIsVisible(event.isVisible);
    });

    return () => {
      disposable.dispose();
    };
  }, [panelApi]);

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
    if (!isVisible) {
      return;
    }

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
    let alarmLines: ReadonlyArray<AlarmLine> = [];
    const alarmLinesByParameter = new Map<string, ReadonlyArray<AlarmLine>>();
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
        plugins: showAlarmLines ? [alarmLinesPlugin(() => alarmLines)] : [],
        scales: {
          y: {
            range: (_plot, dataMin, dataMax) => {
              const values = showAlarmLines ? alarmLines.map((line) => line.value) : [];
              const min = Math.min(dataMin, ...values);
              const max = Math.max(dataMax, ...values);
              const padding = Math.max((max - min) * 0.05, 1);
              return [min - padding, max + padding];
            },
          },
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
        const start = new Date(stop.getTime() - timeWindowSeconds * 1000);

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
      const cutoff = frameNow - timeWindowSeconds;
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
                const defaultAlarm = update.info.type.defaultAlarm;
                const ranges =
                  defaultAlarm?.staticAlarmRanges ?? defaultAlarm?.staticAlarmRange ?? [];
                alarmLinesByParameter.set(series.parameter, getAlarmLines(ranges, series));
                alarmLines = Array.from(alarmLinesByParameter.values()).flat();

                const numericValue = getParameterNumericValue(update);

                if (numericValue === undefined) {
                  dirty = true;
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
  }, [instance, isVisible, seriesConfigs, showAlarmLines, themeRefreshKey, timeWindowSeconds]);

  return (
    <div className="col-span-full h-full w-full pb-8">
      <div className={cn("h-full w-full", className)} ref={containerRef}>
        <div ref={chartRef} />
      </div>
    </div>
  );
}
