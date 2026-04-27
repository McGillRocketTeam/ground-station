import type { ParameterValue } from "@mrt/yamcs-effect";
import type { AsyncResult } from "effect/unstable/reactivity";

import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import * as echarts from "echarts";
import { graphic } from "echarts";
import { DateTime } from "effect";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import type { ChartSeriesConfig } from "./config";
import type {
  ChartPoint,
  ChartSeriesData,
  ChartViewport,
  PanelApi,
} from "./types";

import { DEFAULT_SERIES_CONFIGS } from "./config";
import {
  applySeriesOffset,
  extractNumericValue,
  historyAtom,
  liveParameterAtom,
  LIVE_WINDOW_MS,
  mergePoints,
  viewportAtom,
} from "./data";
import { resizeChart, setChartViewport, updateChartData } from "./echarts";

type DragState = {
  pointerX: number;
  viewportEnd: number;
  viewportStart: number;
};

type ZrPointerEvent = {
  offsetX: number;
};

type ZrWheelEvent = ZrPointerEvent & {
  event?: {
    preventDefault?: () => void;
  };
  wheelDelta?: number;
};

const MIN_VIEWPORT_MS = 1_000;
const MAX_VIEWPORT_MS = 30 * 24 * 60 * 60 * 1000;
const ZOOM_IN_FACTOR = 0.92;
const ZOOM_OUT_FACTOR = 1.08;
const VIEWPORT_FETCH_DEBOUNCE_MS = 150;

function renderRangeItem(params: any, api: any) {
  const time = Number(api.value(0));
  const min = Number(api.value(1));
  const max = Number(api.value(2));
  const bucketWidth = Number(api.value(3));
  const start = api.coord([time - bucketWidth / 2, min]);
  const end = api.coord([time + bucketWidth / 2, max]);
  const shape = graphic.clipRectByRect(
    {
      height: Math.abs(end[1] - start[1]),
      width: Math.max(1, Math.abs(end[0] - start[0])),
      x: Math.min(start[0], end[0]),
      y: Math.min(start[1], end[1]),
    },
    {
      height: params.coordSys.height,
      width: params.coordSys.width,
      x: params.coordSys.x,
      y: params.coordSys.y,
    },
  );

  return (
    shape && {
      shape,
      style: api.style(),
      type: "rect",
    }
  );
}

function getLatestPointTime(seriesData: ChartSeriesData) {
  return Math.max(
    ...Object.values(seriesData).map(
      (points) => points.at(-1)?.time ?? Number.NEGATIVE_INFINITY,
    ),
  );
}

function getLiveViewport(
  seriesData: ChartSeriesData,
): ChartViewport | undefined {
  const latestPointTime = getLatestPointTime(seriesData);
  if (!Number.isFinite(latestPointTime)) return undefined;

  return {
    end: latestPointTime,
    mode: "live",
    start: latestPointTime - LIVE_WINDOW_MS,
  };
}

function emptySeriesData(): ChartSeriesData {
  return {};
}

function snapshotSeriesData(
  archiveData: ChartSeriesData,
  liveData: ChartSeriesData,
  viewport: ChartViewport | null,
): ChartSeriesData {
  const keys = new Set([...Object.keys(archiveData), ...Object.keys(liveData)]);

  return Object.fromEntries(
    Array.from(keys).map((key) => [
      key,
      snapshotSeries(archiveData[key] ?? [], liveData[key] ?? [], viewport),
    ]),
  );
}

function snapshotSeries(
  archivePoints: ChartPoint[],
  livePoints: ChartPoint[],
  viewport: ChartViewport | null,
) {
  if (livePoints.length === 0) return archivePoints;

  const firstLiveTime = livePoints[0]!.time;
  const archiveBeforeLive = archivePoints.filter(
    (point) => point.time < firstLiveTime,
  );

  if (viewport && firstLiveTime > viewport.end) {
    return archiveBeforeLive;
  }

  return mergePoints([...archiveBeforeLive, ...livePoints]);
}

function LiveSeriesSubscription({
  onPoint,
  parameter,
  series,
  seriesKey,
}: {
  onPoint: (seriesKey: string, point: ChartPoint) => void;
  parameter: string;
  series: ChartSeriesConfig;
  seriesKey: string;
}) {
  const handleUpdate = useCallback(
    (result: AsyncResult.AsyncResult<typeof ParameterValue.Type, unknown>) => {
      if (result._tag !== "Success") return;

      const parameterValue = result.value;
      const numericValue = extractNumericValue(parameterValue);
      if (numericValue === undefined) return;

      const offsetValue = applySeriesOffset(numericValue, series);

      onPoint(seriesKey, {
        avg: offsetValue,
        max: offsetValue,
        min: offsetValue,
        time: DateTime.toDate(parameterValue.generationTime).getTime(),
      });
    },
    [onPoint, series, seriesKey],
  );

  useAtomSubscribe(liveParameterAtom(parameter), handleUpdate);

  return null;
}

export function LiveChart({
  api,
  seriesConfigs,
}: {
  api: PanelApi;
  seriesConfigs?: ReadonlyArray<ChartSeriesConfig>;
}) {
  const normalizedSeriesConfigs = useMemo(() => {
    return seriesConfigs?.length ? seriesConfigs : DEFAULT_SERIES_CONFIGS;
  }, [seriesConfigs]);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const archivePointsRef = useRef<ChartSeriesData>(emptySeriesData());
  const livePointsRef = useRef<ChartSeriesData>(emptySeriesData());
  const visiblePointsRef = useRef<ChartSeriesData>(emptySeriesData());
  const viewportRef = useRef<ChartViewport | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const setHistoryViewport = useAtomSet(viewportAtom);
  const historyResult = useAtomValue(historyAtom(normalizedSeriesConfigs));

  const renderSnapshot = useCallback(() => {
    visiblePointsRef.current = snapshotSeriesData(
      archivePointsRef.current,
      livePointsRef.current,
      viewportRef.current,
    );
    updateChartData(
      chartRef.current,
      normalizedSeriesConfigs,
      visiblePointsRef.current,
    );
  }, [normalizedSeriesConfigs]);

  const getLiveViewportFromAllPoints = useCallback(() => {
    return getLiveViewport(
      snapshotSeriesData(archivePointsRef.current, livePointsRef.current, null),
    );
  }, []);

  const resetToLive = useCallback(() => {
    const liveViewport = getLiveViewportFromAllPoints();
    if (!liveViewport) return;

    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = null;
    }

    viewportRef.current = liveViewport;
    dragRef.current = null;
    setChartViewport(chartRef.current, liveViewport.start, liveViewport.end);
    setHistoryViewport(liveViewport);
    renderSnapshot();
  }, [getLiveViewportFromAllPoints, renderSnapshot, setHistoryViewport]);

  const scheduleHistoryFetch = useCallback(
    (viewport: ChartViewport) => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }

      viewportDebounceRef.current = setTimeout(() => {
        setHistoryViewport(viewport);
      }, VIEWPORT_FETCH_DEBOUNCE_MS);
    },
    [setHistoryViewport],
  );

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    chart.setOption({
      animation: false,
      legend: {
        data: normalizedSeriesConfigs.map((series) => series.label),
        top: 4,
      },
      grid: {
        bottom: 56,
        containLabel: true,
        left: 48,
        right: 16,
        top: 40,
      },
      xAxis: {
        type: "time",
      },
      yAxis: {
        scale: true,
        type: "value",
      },
      series: normalizedSeriesConfigs.flatMap((series) => [
        {
          connectNulls: false,
          data: [],
          itemStyle: { color: series.color },
          lineStyle: { color: series.color },
          name: series.label,
          showSymbol: false,
          type: "line",
        },
        {
          data: [],
          itemStyle: { color: series.color, opacity: 0.14 },
          name: `${series.label} Range`,
          renderItem: renderRangeItem,
          silent: true,
          tooltip: { show: false },
          type: "custom",
        },
      ]),
      tooltip: {
        trigger: "axis",
      },
    });

    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, [normalizedSeriesConfigs]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const zr = chart.getZr();

    const handlePointerDown = (event: ZrPointerEvent) => {
      const viewport =
        viewportRef.current ?? getLiveViewport(visiblePointsRef.current);
      if (!viewport) return;

      const pausedViewport: ChartViewport = {
        ...viewport,
        mode: "paused",
      };
      viewportRef.current = pausedViewport;
      dragRef.current = {
        pointerX: event.offsetX,
        viewportEnd: pausedViewport.end,
        viewportStart: pausedViewport.start,
      };

      zr.setCursorStyle("grabbing");
      setChartViewport(chart, pausedViewport.start, pausedViewport.end);
    };

    const handlePointerMove = (event: ZrPointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const chartWidth = Math.max(chart.getWidth(), 1);
      const viewportWidth = drag.viewportEnd - drag.viewportStart;
      const pointerDelta = event.offsetX - drag.pointerX;
      const timeDelta = -(pointerDelta / chartWidth) * viewportWidth;
      const nextViewport: ChartViewport = {
        end: drag.viewportEnd + timeDelta,
        mode: "paused",
        start: drag.viewportStart + timeDelta,
      };

      viewportRef.current = nextViewport;
      setChartViewport(chart, nextViewport.start, nextViewport.end);
      scheduleHistoryFetch(nextViewport);
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      zr.setCursorStyle("default");
    };

    const handleWheel = (event: ZrWheelEvent) => {
      event.event?.preventDefault?.();

      const viewport =
        viewportRef.current ?? getLiveViewport(visiblePointsRef.current);
      if (!viewport) return;

      const chartWidth = Math.max(chart.getWidth(), 1);
      const currentWidth = viewport.end - viewport.start;
      const zoomFactor =
        (event.wheelDelta ?? 0) > 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
      const nextWidth = Math.min(
        MAX_VIEWPORT_MS,
        Math.max(MIN_VIEWPORT_MS, currentWidth * zoomFactor),
      );
      const cursorRatio = Math.min(1, Math.max(0, event.offsetX / chartWidth));
      const anchorTime = viewport.start + currentWidth * cursorRatio;
      const nextViewport: ChartViewport = {
        end: anchorTime + nextWidth * (1 - cursorRatio),
        mode: "paused",
        start: anchorTime - nextWidth * cursorRatio,
      };

      viewportRef.current = nextViewport;
      setChartViewport(chart, nextViewport.start, nextViewport.end);
      scheduleHistoryFetch(nextViewport);
    };

    zr.on("mousedown", handlePointerDown);
    zr.on("mousemove", handlePointerMove);
    zr.on("mouseup", handlePointerUp);
    zr.on("globalout", handlePointerUp);
    zr.on("mousewheel", handleWheel);

    return () => {
      zr.off("mousedown", handlePointerDown);
      zr.off("mousemove", handlePointerMove);
      zr.off("mouseup", handlePointerUp);
      zr.off("globalout", handlePointerUp);
      zr.off("mousewheel", handleWheel);
    };
  }, [scheduleHistoryFetch]);

  useEffect(
    () => () => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    },
    [],
  );

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

    archivePointsRef.current = historyResult.value;
    renderSnapshot();

    if (!viewportRef.current || viewportRef.current.mode === "live") {
      const liveViewport = getLiveViewport(visiblePointsRef.current);
      if (!liveViewport) return;

      viewportRef.current = liveViewport;
      setChartViewport(chartRef.current, liveViewport.start, liveViewport.end);
    }
  }, [historyResult, renderSnapshot]);

  const applyLivePoint = useCallback(
    (series: string, point: ChartPoint) => {
      livePointsRef.current = {
        ...livePointsRef.current,
        [series]: mergePoints([
          ...(livePointsRef.current[series] ?? []),
          point,
        ]),
      };

      if (viewportRef.current?.mode === "paused") {
        renderSnapshot();
        return;
      }

      const liveViewport = getLiveViewportFromAllPoints();
      if (!liveViewport) return;

      viewportRef.current = liveViewport;
      setChartViewport(chartRef.current, liveViewport.start, liveViewport.end);
      renderSnapshot();
    },
    [getLiveViewportFromAllPoints, renderSnapshot],
  );

  return (
    <ContextMenu>
      {normalizedSeriesConfigs.map((series) => (
        <LiveSeriesSubscription
          key={series.parameter}
          parameter={series.parameter}
          series={series}
          seriesKey={series.parameter}
          onPoint={applyLivePoint}
        />
      ))}
      <ContextMenuTrigger asChild>
        <div ref={containerRef} className="h-full w-full" />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={resetToLive}>Reset to live</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
