import { useAtomSuspense } from "@effect/atom-react";
import { type IGridviewPanelProps } from "dockview-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "uplot/dist/uPlot.min.css";
import uPlot, { type AlignedData } from "uplot";

import { cn } from "@/lib/utils";

import { flightReplayStateAtom, type FlightPacket, type RecoveryEvent } from "../data";

const DEFAULT_CHART_WIDTH = 640;
const DEFAULT_CHART_HEIGHT = 220;
const DEFAULT_SERIES_COLOR = "#f97316";
const CHART_SYNC_KEY = "flight-review-telemetry-charts";

type PlotThemeColors = {
  border: string;
  muted: string;
};

type TelemetryChartParams = {
  readonly annotationLabels?: boolean;
  readonly color?: string;
  readonly parameter: string;
  readonly title: string;
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const valueFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
});

function withAlpha(color: string, alphaHex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : color;
}

function getPlotThemeColors(container: HTMLElement): PlotThemeColors {
  const styles = getComputedStyle(container);

  return {
    border: styles.getPropertyValue("--border").trim(),
    muted: styles.getPropertyValue("--muted-foreground").trim(),
  };
}

function makeAxisOptions(colors: PlotThemeColors): uPlot.Axis[] {
  return [
    {
      border: { stroke: colors.border },
      grid: { stroke: colors.border },
      stroke: colors.muted,
      ticks: { stroke: colors.border },
      values: (_self, splits) =>
        splits.map((value) => timeFormatter.format(new Date(value * 1000))),
    },
    {
      border: { stroke: colors.border },
      grid: { stroke: colors.border },
      stroke: colors.muted,
      ticks: { stroke: colors.border },
      values: (_self, splits) => splits.map((value) => valueFormatter.format(value)),
    },
  ];
}

function recoveryEventsPlugin(
  events: ReadonlyArray<RecoveryEvent>,
  showLabels: boolean,
): uPlot.Plugin {
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

          for (const event of events) {
            const x = Math.round(plot.valToPos(event.timeMs / 1000, "x", true));
            if (x < left || x > left + width) continue;

            const isMain = event.label.includes("Main");
            const isSystemB = event.label.startsWith("B ");
            const color = isMain ? "#22c55e" : "#38bdf8";

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 * pixelRatio;
            ctx.setLineDash(isSystemB ? [4 * pixelRatio, 3 * pixelRatio] : []);
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + height);
            ctx.stroke();

            if (!showLabels) continue;

            const label = event.label.replace(/^[AB] /, "").toUpperCase();
            ctx.font = `${9 * pixelRatio}px sans-serif`;
            const labelWidth = ctx.measureText(label).width + 8 * pixelRatio;
            const labelHeight = 15 * pixelRatio;
            const labelX = x + 4 * pixelRatio;
            const labelY = Math.min(top + height - labelWidth, top + 4 * pixelRatio);

            ctx.setLineDash([]);
            ctx.save();
            ctx.translate(labelX + labelHeight, labelY);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = "#09090b";
            ctx.fillRect(0, 0, labelWidth, labelHeight);
            ctx.strokeStyle = color;
            ctx.lineWidth = pixelRatio;
            ctx.strokeRect(0, 0, labelWidth, labelHeight);
            ctx.fillStyle = color;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(label, 4 * pixelRatio, labelHeight / 2);
            ctx.restore();
          }

          ctx.restore();
        },
      ],
    },
  };
}

function parseNumericValue(rawValue: string | undefined) {
  if (rawValue === undefined || rawValue === "") {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildAlignedData(
  packets: ReadonlyArray<FlightPacket>,
  parameter: string,
  currentCursorPacketIndex: number,
): AlignedData {
  if (currentCursorPacketIndex < 0) {
    return [[], []];
  }

  const visiblePackets = packets.slice(0, currentCursorPacketIndex + 1);
  const timestamps = visiblePackets.map((packet) => packet.timeMs / 1000);
  const values = visiblePackets.map((packet) => parseNumericValue(packet.parameters[parameter]));

  return [timestamps, values];
}

function TelemetryChart({
  annotationLabels = false,
  color,
  parameter,
  title,
}: TelemetryChartParams) {
  const flightReplay = useAtomSuspense(flightReplayStateAtom).value;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const xScaleRef = useRef({
    min: flightReplay.flightStartMs / 1000,
    max: flightReplay.flightEndMs / 1000,
  });
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);

  const seriesColor = color ?? DEFAULT_SERIES_COLOR;
  const hasSeries = flightReplay.parameterNames.includes(parameter);
  const chartData = useMemo(
    () => buildAlignedData(flightReplay.packets, parameter, flightReplay.currentCursorPacketIndex),
    [flightReplay.currentCursorPacketIndex, flightReplay.packets, parameter],
  );

  useEffect(() => {
    xScaleRef.current = {
      min: flightReplay.flightStartMs / 1000,
      max: flightReplay.flightEndMs / 1000,
    };
  }, [flightReplay.flightEndMs, flightReplay.flightStartMs]);

  const resetXScale = () => {
    const nextScale = {
      min: flightReplay.flightStartMs / 1000,
      max: flightReplay.flightEndMs / 1000,
    };

    xScaleRef.current = nextScale;

    for (const plot of uPlot.sync(CHART_SYNC_KEY).plots) {
      plot.setScale("x", nextScale);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !chartRef.current || !hasSeries) {
      return;
    }

    const measureSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();

      return {
        width: Math.max(100, Math.floor(rect?.width ?? DEFAULT_CHART_WIDTH)),
        height: Math.max(100, Math.floor(rect?.height ?? DEFAULT_CHART_HEIGHT)),
      };
    };

    const themeColors = getPlotThemeColors(containerRef.current);
    const plot = new uPlot(
      {
        ...measureSize(),
        axes: makeAxisOptions(themeColors),
        cursor: {
          bind: {
            dblclick: (_self, _targ, handler) => (event) => {
              handler(event);
              resetXScale();
              return null;
            },
          },
          drag: {
            setScale: true,
            x: true,
            y: false,
          },
          sync: {
            key: CHART_SYNC_KEY,
            scales: ["x", null],
          },
        },
        hooks: {
          setScale: [
            (self, scaleKey) => {
              if (scaleKey !== "x") {
                return;
              }

              const nextMin = self.scales.x.min;
              const nextMax = self.scales.x.max;

              if (nextMin == null || nextMax == null) {
                return;
              }

              xScaleRef.current = {
                min: nextMin,
                max: nextMax,
              };
            },
          ],
          setCursor: [
            (self) => {
              setCursorIndex((current) =>
                current === self.cursor.idx ? current : (self.cursor.idx ?? null),
              );
            },
          ],
        },
        legend: {
          show: false,
        },
        plugins: [recoveryEventsPlugin(flightReplay.recoveryEvents, annotationLabels)],
        scales: {
          x: {
            auto: false,
            min: xScaleRef.current.min,
            max: xScaleRef.current.max,
            time: true,
          },
        },
        series: [
          {},
          {
            label: title,
            stroke: seriesColor,
            fill: withAlpha(seriesColor, "26"),
            width: 2,
            points: {
              show: true,
              size: 4,
              stroke: seriesColor,
              fill: seriesColor,
            },
            spanGaps: false,
            value: (_self, rawValue: number | null) =>
              rawValue == null ? "" : valueFormatter.format(rawValue),
          },
        ],
      },
      chartData,
      chartRef.current,
    );

    const resizeObserver = new ResizeObserver(() => {
      plot.setSize(measureSize());
    });

    resizeObserver.observe(containerRef.current);
    plotRef.current = plot;

    return () => {
      plotRef.current = null;
      resizeObserver.disconnect();
      plot.destroy();
    };
  }, [
    flightReplay.flightEndMs,
    flightReplay.flightStartMs,
    flightReplay.recoveryEvents,
    annotationLabels,
    hasSeries,
    seriesColor,
    title,
  ]);

  useEffect(() => {
    if (!plotRef.current || !hasSeries) {
      return;
    }

    const plot = plotRef.current;

    plot.batch(() => {
      plot.setData(chartData);
      plot.setScale("x", xScaleRef.current);
    });
  }, [chartData, hasSeries]);

  const displayedPacketIndex = cursorIndex ?? flightReplay.currentCursorPacketIndex;
  const displayedPacket = flightReplay.packets[displayedPacketIndex];
  const displayedValue = parseNumericValue(displayedPacket?.parameters[parameter]);

  if (!hasSeries) {
    return (
      <div className="grid h-full w-full place-items-center font-mono text-xs text-muted-foreground">
        No data for {title}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-background-secondary px-2 py-1 font-mono text-xs uppercase text-white-text">
        {title}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-border px-2 pt-2 font-mono text-[11px] text-muted-foreground">
        <div className="truncate">
          {displayedPacket ? displayedPacket.time : "No packet selected"}
        </div>
        <div className="text-right text-white-text">
          {displayedValue == null ? "-" : valueFormatter.format(displayedValue)}
        </div>
      </div>
      <div
        className={cn("min-h-0 flex-1 w-full px-2 pb-2 pt-1", "flight-review-plot")}
        ref={containerRef}
      >
        <div ref={chartRef} />
      </div>
    </div>
  );
}

export function TelemetryChartPanel(props: IGridviewPanelProps) {
  const params = (props.params ?? {}) as Partial<TelemetryChartParams>;

  if (!params.parameter || !params.title) {
    return (
      <div className="grid h-full w-full place-items-center font-mono text-xs text-muted-foreground">
        Chart config missing
      </div>
    );
  }

  return (
    <TelemetryChart
      annotationLabels={params.annotationLabels}
      color={params.color}
      parameter={params.parameter}
      title={params.title}
    />
  );
}
