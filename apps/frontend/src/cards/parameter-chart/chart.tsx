import type { ParameterValue } from "@mrt/yamcs-effect";

import {
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomSubscribe,
  useAtomValue,
} from "@effect/atom-react";
import Dygraph from "dygraphs";
import { DateTime, Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import {
  YamcsAtomHttpClient,
  parameterSubscriptionAtom,
  selectedInstanceAtom,
} from "@/lib/atom";

const isDurationMode = (mode: ChartMode): mode is DurationMode =>
  mode.type === "duration";

const MAX_DATA_POINTS = 1000;
const PARAMETER_NAME = "/SystemA/Rocket/FlightComputer/acceleration_x";
const parameterLiveAtom = parameterSubscriptionAtom(PARAMETER_NAME);

type DurationMode = {
  type: "duration";
  durationMs: number;
};

type FixedWindowMode = {
  type: "fixed";
  start: Date;
  end: Date;
};

type ChartMode = DurationMode | FixedWindowMode;

const defaultMode: ChartMode = {
  type: "duration",
  durationMs: 60 * 1000,
};

const chartModeAtom: Atom.Writable<ChartMode, ChartMode> = Atom.make(
  defaultMode,
) as Atom.Writable<ChartMode, ChartMode>;

const isFixedWindowInPast = (mode: ChartMode): boolean => {
  if (mode.type !== "fixed") return false;
  return mode.end.getTime() < Date.now();
};

const timeRangeAtom = Atom.make((get) => {
  const mode = get(chartModeAtom);

  if (mode.type === "duration") {
    const durationMode = mode as DurationMode;
    const end = new Date();
    const start = new Date(end.getTime() - durationMode.durationMs);
    return { start, end, isLive: true };
  } else {
    const fixedMode = mode as FixedWindowMode;
    return {
      start: fixedMode.start,
      end: fixedMode.end,
      isLive: !isFixedWindowInPast(fixedMode),
    };
  }
});

// Data point with custom bands: [Date, [min, avg, max]]
type BandDataPoint = [Date, [number, number, number]];

const chartHistoryAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const instance = get(selectedInstanceAtom);
    const { start, end } = get(timeRangeAtom);

    const query: { start: string; stop?: string } = {
      start: start.toISOString(),
    };
    if (end.getTime() < Date.now()) {
      query.stop = end.toISOString();
    }

    const history = yield* get.resultOnce(
      YamcsAtomHttpClient.query("parameter", "getSamples", {
        params: {
          instance,
          parameterName: PARAMETER_NAME,
        },
        query,
      }),
    );

    // Map to [Date, [min, avg, max]] format for dygraphs customBars
    const data = history.sample.map((h) => [
      DateTime.toDate(h.time),
      [h.min ?? h.avg, h.avg, h.max ?? h.avg],
    ]) as BandDataPoint[];
    return data;
  }),
);

const chartDataWithSubscriptionAtom: Atom.Writable<
  BandDataPoint[],
  BandDataPoint | BandDataPoint[]
> = Atom.writable(
  (get) => {
    const initialResult = get(chartHistoryAtom);
    if (initialResult._tag === "Success") {
      return initialResult.value;
    }
    return [] as BandDataPoint[];
  },
  (ctx, update: BandDataPoint | BandDataPoint[]) => {
    if (
      Array.isArray(update) &&
      update.length > 0 &&
      Array.isArray(update[0])
    ) {
      ctx.setSelf(update as BandDataPoint[]);
    } else {
      const currentData = ctx.get(chartDataWithSubscriptionAtom);
      const updatedData = [...currentData, update as BandDataPoint];
      if (updatedData.length > MAX_DATA_POINTS) {
        updatedData.shift();
      }
      ctx.setSelf(updatedData);
    }
  },
) as Atom.Writable<BandDataPoint[], BandDataPoint | BandDataPoint[]>;

export function ParameterChart() {
  const parentRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Dygraph>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useAtom(chartModeAtom);
  const timeRange = useAtomValue(timeRangeAtom);
  const chartData = useAtomValue(chartDataWithSubscriptionAtom);

  // Refs prevent stale closures in subscription callback without causing re-renders
  const isLiveRef = useRef(timeRange.isLive);
  const modeRef = useRef(mode);
  const dataRef = useRef<BandDataPoint[]>(chartData);
  isLiveRef.current = timeRange.isLive;
  modeRef.current = mode;
  dataRef.current = chartData;

  const setChartData = useAtomSet(chartDataWithSubscriptionAtom);
  const refreshChartData = useAtomRefresh(chartDataWithSubscriptionAtom);

  const handleParameterUpdate = useCallback(
    (result: AsyncResult.AsyncResult<typeof ParameterValue.Type, unknown>) => {
      if (!isLiveRef.current) return;

      if (result._tag === "Success") {
        const parameterValue = result.value;
        const timestamp = DateTime.toDate(parameterValue.generationTime);
        let numericValue = 0;

        if (parameterValue.engValue && "value" in parameterValue.engValue) {
          numericValue = Number(parameterValue.engValue.value) || 0;
        } else if (
          parameterValue.rawValue &&
          "value" in parameterValue.rawValue
        ) {
          numericValue = Number(parameterValue.rawValue.value) || 0;
        }

        const currentMode = modeRef.current;
        const newPoint: BandDataPoint = [
          timestamp,
          [numericValue, numericValue, numericValue],
        ];

        if (currentMode.type === "duration") {
          const cutoffTime = timestamp.getTime() - currentMode.durationMs;
          const currentData = dataRef.current;
          const filtered = currentData.filter(
            (point) => point[0].getTime() >= cutoffTime,
          );
          const newData: BandDataPoint[] = [...filtered, newPoint];
          if (
            newData.length !== currentData.length ||
            filtered.length !== currentData.length
          ) {
            setChartData(newData);
          }
        } else {
          setChartData(newPoint);
        }
      }
    },
    [setChartData],
  );

  useAtomSubscribe(parameterLiveAtom, handleParameterUpdate);

  const handleZoom = useCallback(
    (minDate: number, maxDate: number) => {
      setMode({
        type: "fixed",
        start: new Date(minDate),
        end: new Date(maxDate),
      });
    },
    [setMode],
  );

  const handleDoubleClick = useCallback(
    (
      _event: MouseEvent,
      _g: Dygraph,
      _context: { cancelNextDblclick?: boolean },
    ) => {
      // Always reset to duration mode regardless of dygraphs internal state
      setMode({ type: "duration", durationMs: 60 * 1000 });
      refreshChartData();
    },
    [setMode, refreshChartData],
  );

  // Build interaction model once to avoid recreating it on every render
  const interactionModel = useMemo(
    () => ({
      ...Dygraph.defaultInteractionModel,
      dblclick: handleDoubleClick,
    }),
    [handleDoubleClick],
  );

  useLayoutEffect(() => {
    if (!containerRef.current || chartData.length === 0) {
      return;
    }

    if (!chartRef.current) {
      chartRef.current = new Dygraph(containerRef.current, chartData, {
        labels: ["Time", "Value"],
        legend: "never",
        connectSeparatedPoints: true,
        drawGapEdgePoints: true,
        customBars: true,
        zoomCallback: handleZoom,
        interactionModel,
        strokeWidth: 2,
      });
      return;
    }

    chartRef.current.updateOptions({ file: chartData });
  }, [chartData, handleZoom, interactionModel]);

  // Only update zoomCallback since interactionModel is memoized
  useLayoutEffect(() => {
    if (chartRef.current) {
      chartRef.current.updateOptions({
        zoomCallback: handleZoom,
      });
    }
  }, [handleZoom]);

  // Reset dygraphs zoom when switching to duration mode so the chart shows the full live window
  useEffect(() => {
    if (isDurationMode(mode) && chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, [mode]);

  useLayoutEffect(() => {
    if (!parentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chartRef?.current?.resize(width, height);
      }
    });

    observer.observe(parentRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={parentRef} className="absolute inset-0 bottom-2 grid">
      {/* <ModeControls /> */}
      <div ref={containerRef} />
    </div>
  );
}
