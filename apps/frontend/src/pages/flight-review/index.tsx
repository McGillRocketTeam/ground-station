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
import { TelemetryChartPanel } from "./panels/telemetry-chart";
import { TimelinePanel } from "./panels/timeline";

const ACCELERATION_X_PARAMETER = "/SystemB/Rocket/FlightComputer/acceleration_x";
const ACCELERATION_Y_PARAMETER = "/SystemB/Rocket/FlightComputer/acceleration_y";
const ACCELERATION_Z_PARAMETER = "/SystemB/Rocket/FlightComputer/acceleration_z";

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
    const timelineHeight = 100;
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
                          color: "#f97316",
                          parameter: ACCELERATION_X_PARAMETER,
                          title: "Acceleration X",
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
                          color: "#38bdf8",
                          parameter: ACCELERATION_Y_PARAMETER,
                          title: "Acceleration Y",
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
                          color: "#22c55e",
                          parameter: ACCELERATION_Z_PARAMETER,
                          title: "Acceleration Z",
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
