import { useAtomSuspense } from "@effect/atom-react";

import "../dashboard.css";
import "./flight-review.css";
import { GridviewReact, Orientation, type GridviewReadyEvent } from "dockview-react";
import { Suspense } from "react";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import "../dashboard.css";
import { flightReplayStateAtom } from "./data";
import { DataTablePanel } from "./panels/data-table";
import { MapPanel } from "./panels/map";
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
  placeholder: PlaceholderPanel,
  map: MapPanel,
  dataTable: DataTablePanel,
};

export function FlightReviewPage() {
  const onReady = (event: GridviewReadyEvent) => {
    event.api.addPanel({ id: "panel_1", component: "dataTable" });
    event.api.addPanel({
      id: "panel_2",
      component: "timeline",
      position: { referencePanel: "panel_1", direction: "below" },
      maximumHeight: 100,
    });
    event.api.addPanel({
      id: "panel_3",
      component: "map",
      position: { referencePanel: "panel_1", direction: "right" },
    });
  };

  return (
    <div className="w-screen h-screen">
      <Suspense
        fallback={
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading flight replay...
          </div>
        }
      >
        <GridviewReact
          // theme={{ ...themeAbyssSpaced, gap: 5 }}
          orientation={Orientation.VERTICAL}
          onReady={onReady}
          components={components}
        />
      </Suspense>
    </div>
  );
}
