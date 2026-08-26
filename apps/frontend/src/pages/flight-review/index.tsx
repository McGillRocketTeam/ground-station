import { useAtom, useAtomSuspense, useAtomValue } from "@effect/atom-react";

import "../dashboard.css";
import "./flight-review.css";
import { GridviewReact, Orientation, type GridviewReadyEvent } from "dockview-react";
import { Cause } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Suspense, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import "../dashboard.css";
import {
  ALTITUDE_PARAMETER,
  APOGEE_PARAMETER,
  flightReplayStateAtom,
  loadFlightReplayAtom,
  suggestedFlightRangesAtom,
  VERTICAL_SPEED_PARAMETER,
} from "./data";
import { DataTablePanel } from "./panels/data-table";
import { MapPanel } from "./panels/map";
import { TelemetryChartPanel } from "./panels/telemetry-chart";
import { TimelinePanel } from "./panels/timeline";

export const STAGE_COLORS: Record<string, string> = {
  Pad: "#64748b",
  Ascent: "#f97316",
  "Pre-Apogee": "#eab308",
  "Drogue descent": "#38bdf8",
  "Main descent": "#22c55e",
};

const PlaceholderPanel = () => {
  const flightReplay = useAtomSuspense(flightReplayStateAtom).value;

  return (
    <div className="flex h-full w-full items-center justify-between px-4 font-mono text-xs">
      <div>
        <div className="text-muted-foreground">Cursor</div>
        <div>{flightReplay.currentCursorTime || "No packet selected"}</div>
      </div>
      <div className="text-right">
        <div className="text-muted-foreground">Stage</div>
        <div>{flightReplay.currentFlightStage}</div>
      </div>
    </div>
  );
};

const components = {
  timeline: TimelinePanel,
  telemetryChart: TelemetryChartPanel,
  placeholder: PlaceholderPanel,
  map: MapPanel,
  dataTable: DataTablePanel,
};

export function FlightReviewPage() {
  const onReady = (event: GridviewReadyEvent) => {
    const timelineHeight = 130;
    const rootHeight = Math.max(event.api.height, timelineHeight * 2);
    const rootWidth = Math.max(event.api.width, 400);
    const topHeight = Math.max(rootHeight - timelineHeight, timelineHeight);
    const leftWidth = Math.max(Math.floor(rootWidth * 0.55), 240);
    const mapWidth = Math.max(rootWidth - leftWidth, 240);
    const chartHeight = Math.max(Math.floor(topHeight * 0.2), 140);
    const tableHeight = Math.max(topHeight - chartHeight * 3, 160);

    event.api.fromJSON({
      activePanel: "panel_1",
      grid: {
        height: rootHeight,
        width: rootWidth,
        orientation: Orientation.VERTICAL,
        root: {
          type: "branch",
          size: rootHeight,
          data: [
            {
              type: "branch",
              size: topHeight,
              data: [
                {
                  type: "branch",
                  size: leftWidth,
                  data: [
                    {
                      type: "leaf",
                      size: tableHeight,
                      data: { id: "panel_1", component: "dataTable" },
                    },
                    {
                      type: "leaf",
                      size: chartHeight,
                      data: {
                        id: "panel_2",
                        component: "telemetryChart",
                        params: {
                          annotationLabels: true,
                          color: "#38bdf8",
                          parameter: ALTITUDE_PARAMETER,
                          title: "Altitude above pad (ft)",
                        },
                      },
                    },
                    {
                      type: "leaf",
                      size: chartHeight,
                      data: {
                        id: "panel_5",
                        component: "telemetryChart",
                        params: {
                          color: "#f97316",
                          parameter: VERTICAL_SPEED_PARAMETER,
                          title: "Vertical speed (ft/s)",
                        },
                      },
                    },
                    {
                      type: "leaf",
                      size: chartHeight,
                      data: {
                        id: "panel_6",
                        component: "telemetryChart",
                        params: {
                          color: "#eab308",
                          parameter: APOGEE_PARAMETER,
                          title: "Recorded apogee (ft)",
                        },
                      },
                    },
                  ],
                },
                {
                  type: "leaf",
                  size: mapWidth,
                  data: { id: "panel_3", component: "map" },
                },
              ],
            },
            {
              type: "leaf",
              size: timelineHeight,
              data: {
                id: "panel_4",
                component: "timeline",
                maximumHeight: timelineHeight,
              },
            },
          ],
        },
      },
    });
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <FlightRangeToolbar />
      <Suspense
        fallback={
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading flight replay...
          </div>
        }
      >
        <div className="min-h-0 flex-1">
          <GridviewReact
            orientation={Orientation.VERTICAL}
            onReady={onReady}
            components={components}
          />
        </div>
      </Suspense>
    </div>
  );
}

const toDateTimeLocal = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
};

function FlightRangeToolbar() {
  const defaultStop = new Date();
  const [start, setStart] = useState(() =>
    toDateTimeLocal(new Date(defaultStop.getTime() - 15 * 60_000)),
  );
  const [stop, setStop] = useState(() => toDateTimeLocal(defaultStop));
  const [loadResult, loadFlightReplay] = useAtom(loadFlightReplayAtom);
  const suggestedRangesResult = useAtomValue(suggestedFlightRangesAtom);
  const loading = AsyncResult.isWaiting(loadResult);
  const error = AsyncResult.isFailure(loadResult) ? Cause.pretty(loadResult.cause) : undefined;
  const suggestedRanges = AsyncResult.isSuccess(suggestedRangesResult)
    ? suggestedRangesResult.value
    : [];

  const selectSuggestedRange = (value: unknown) => {
    if (typeof value !== "string") return;
    const range = suggestedRanges[Number(value)];
    if (!range) return;
    setStart(toDateTimeLocal(new Date(range.start)));
    setStop(toDateTimeLocal(new Date(range.stop)));
    loadFlightReplay(range);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    loadFlightReplay({
      start: new Date(start).toISOString(),
      stop: new Date(stop).toISOString(),
    });
  };

  return (
    <form
      className="flex min-h-10 flex-wrap items-center gap-2 border-b bg-background-secondary"
      onSubmit={submit}
    >
      <Select onValueChange={selectSuggestedRange}>
        <SelectTrigger className="h-10 w-64 rounded-none border-y-0 border-l-0 font-mono">
          <SelectValue>
            {AsyncResult.isWaiting(suggestedRangesResult)
              ? "Finding flights..."
              : suggestedRanges.length === 0
                ? "No detected flights in 24h"
                : "Suggested flights"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            <SelectLabel>Flights detected by stage 1 -&gt; 2, last 24 hours</SelectLabel>
            {suggestedRanges.map((range, index) => (
              <SelectItem key={`${range.start}-${range.stop}`} value={String(index)}>
                {formatSuggestedRange(range.start, range.stop)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 font-mono text-xs">
        Start
        <Input
          className="h-8 w-52 font-mono text-xs"
          type="datetime-local"
          step="1"
          required
          value={start}
          onChange={(event) => setStart(event.currentTarget.value)}
        />
      </label>
      <label className="flex items-center gap-2 font-mono text-xs">
        Stop
        <Input
          className="h-8 w-52 font-mono text-xs"
          type="datetime-local"
          step="1"
          required
          value={stop}
          onChange={(event) => setStop(event.currentTarget.value)}
        />
      </label>
      <Button className="h-8" size="sm" type="submit" disabled={loading}>
        {loading ? "Loading..." : "Load telemetry"}
      </Button>
      {error ? (
        <span className="max-w-xl truncate text-xs text-destructive" title={error}>
          Unable to load telemetry: {error}
        </span>
      ) : null}
    </form>
  );
}

const formatSuggestedRange = (start: string, stop: string) => {
  const startDate = new Date(start);
  const stopDate = new Date(stop);
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(startDate);
  const time = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" });
  return `${date}, ${time.format(startDate)} - ${time.format(stopDate)}`;
};
