import {
  Atom,
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomSubscribe,
  useAtomValue,
} from "@effect-atom/atom-react";
import { parameterSubscriptionAtom, YamcsAtomClient } from "@mrt/yamcs-atom";
import Dygraph from "dygraphs";
import { Effect } from "effect";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

const isDurationMode = (mode: ChartMode): mode is DurationMode =>
  mode.type === "duration";

const MAX_DATA_POINTS = 1000;
const PARAMETER_NAME = "/FlightComputer/acceleration_x";

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
    const { start, end } = get(timeRangeAtom);

    const urlParams: { start: Date; stop?: Date } = { start };
    if (end.getTime() < Date.now()) {
      urlParams.stop = end;
    }

    const history = yield* get.resultOnce(
      YamcsAtomClient.query("parameter", "getSamples", {
        path: {
          instance: import.meta.env.YAMCS_INSTANCE,
          parameterName: PARAMETER_NAME,
        },
        urlParams,
      }),
    );

    // Map to [Date, [min, avg, max]] format for dygraphs customBars
    const data = history.sample.map((h) => [
      h.time,
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

function ModeControls() {
  const [mode, setMode] = useAtom(chartModeAtom);

  const isDuration = mode.type === "duration";
  const durationMinutes = isDuration
    ? (mode as DurationMode).durationMs / 60000
    : 1;
  const fixedMode = !isDuration ? (mode as FixedWindowMode) : null;

  return (
    <div className="bg-background/80 border-border absolute top-2 left-2 z-10 rounded border p-2 text-xs backdrop-blur-sm">
      <div className="mb-2 flex gap-2">
        <button
          onClick={() =>
            setMode({ type: "duration", durationMs: durationMinutes * 60000 })
          }
          className={`rounded px-2 py-1 ${
            isDuration
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          Duration
        </button>
        <button
          onClick={() =>
            setMode({
              type: "fixed",
              start: new Date(Date.now() - 60000),
              end: new Date(),
            })
          }
          className={`rounded px-2 py-1 ${
            !isDuration
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          Fixed
        </button>
      </div>

      {isDuration ? (
        <div className="flex items-center gap-2">
          <label>Last</label>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => {
              const mins = parseInt(e.target.value) || 1;
              setMode({ type: "duration", durationMs: mins * 60000 });
            }}
            className="bg-background border-border w-16 rounded border px-1 py-0.5"
            min="1"
          />
          <span>min</span>
        </div>
      ) : fixedMode ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label className="w-8">Start</label>
            <input
              type="datetime-local"
              value={formatDateTimeLocal(fixedMode.start)}
              onChange={(e) => {
                const start = new Date(e.target.value);
                setMode({ type: "fixed", start, end: fixedMode.end });
              }}
              className="bg-background border-border rounded border px-1 py-0.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-8">End</label>
            <input
              type="datetime-local"
              value={formatDateTimeLocal(fixedMode.end)}
              onChange={(e) => {
                const end = new Date(e.target.value);
                setMode({ type: "fixed", start: fixedMode.start, end });
              }}
              className="bg-background border-border rounded border px-1 py-0.5"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

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

  // No 'immediate' option - prevents infinite loop from atom triggering its own update
  useAtomSubscribe(parameterSubscriptionAtom(PARAMETER_NAME), (result) => {
    if (!isLiveRef.current) return;

    if (result._tag === "Success") {
      const parameterValue = result.value;
      const timestamp = new Date(parameterValue.generationTime);
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
        // Filter points outside the sliding window (creates scrolling effect)
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
  });

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

  useAtomValue(chartDataWithSubscriptionAtom, (data) => {
    if (!chartRef.current && containerRef.current && data.length > 0) {
      chartRef.current = new Dygraph(containerRef.current, data, {
        labels: ["Time", "Value"],
        legend: "never",
        connectSeparatedPoints: true,
        drawGapEdgePoints: true,
        customBars: true, // Enable high/low bands using [min, avg, max] format
        zoomCallback: handleZoom,
        interactionModel,
        strokeWidth: 2,
      });
    } else if (data.length > 0) {
      chartRef.current!.updateOptions({ file: data });
    }
  });

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
      <div ref={containerRef} />
    </div>
  );
}
