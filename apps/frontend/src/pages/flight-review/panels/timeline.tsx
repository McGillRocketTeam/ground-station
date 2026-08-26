import { useAtomSuspense, useAtomSet } from "@effect/atom-react";
import { type IGridviewPanelProps } from "dockview-react";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import { useEffect, useRef } from "react";
import * as vis from "vis-timeline";

import { flightReplayStateAtom, setFlightReplayCursorAtom, snapToPacketTime } from "../data";

export const STAGE_COLORS: Record<string, string> = {
  Pad: "#64748b",
  Ascent: "#f97316",
  "Pre-Apogee": "#eab308",
  "Drogue descent": "#38bdf8",
  "Main descent": "#22c55e",
};

const CURSOR_BAR_ID = "flight-replay-cursor";
export const TimelinePanel = (props: IGridviewPanelProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<vis.Timeline | null>(null);
  const flightReplay = useAtomSuspense(flightReplayStateAtom).value;
  const setCursor = useAtomSet(setFlightReplayCursorAtom);

  useEffect(() => {
    if (!ref.current || !flightReplay.flightStart || !flightReplay.flightEnd) return;

    const groups = [
      { id: "stages", content: "Flight Stage" },
      { id: "telemetry", content: "Telemetry" },
      { id: "recovery", content: "Recovery" },
    ];

    const items = [
      ...flightReplay.telemetryConnections.map((window) => ({
        id: window.id,
        group: "telemetry",
        content: "",
        start: window.start,
        end: window.end,
        type: "range" as const,
        className: "flight-review-telemetry-window",
        title: `${window.packetCount} packets`,
      })),
      ...flightReplay.stages.map((window) => ({
        id: window.id,
        group: "stages",
        content: window.stage,
        start: window.start,
        end: window.end,
        type: "range" as const,
        className: "flight-review-stage-window",
        style: `background-color: ${STAGE_COLORS[window.stage] ?? "#52525b"}; border-color: transparent; color: contrast-color(${STAGE_COLORS[window.stage] ?? "#52525b"}); font-weight: normal; font-size: 12px; font-family: var(--font-mono); text-transform: uppercase;`,
      })),
      ...flightReplay.recoveryEvents.map((event) => ({
        id: event.id,
        group: "recovery",
        content: "",
        start: event.time,
        type: "box" as const,
        title: `${event.label}\n${new Date(event.time).toLocaleString()}`,
        className: event.label.includes("Main")
          ? "flight-review-recovery-event flight-review-recovery-event-main"
          : "flight-review-recovery-event flight-review-recovery-event-drogue",
      })),
    ];

    const timeline = new vis.Timeline(ref.current, items, groups, {
      start: flightReplay.flightStart,
      end: flightReplay.flightEnd,
      min: flightReplay.flightStart,
      max: flightReplay.flightEnd,
      stack: false,
      zoomMin: 1,
      zoomMax: flightReplay.flightEndMs - flightReplay.flightStartMs,
      showCurrentTime: false,
      orientation: { axis: "top", item: "top" },
      margin: { item: 4, axis: 6 },
      snap: (date) => new Date(snapToPacketTime(flightReplay.packets, Number(date)).timeMs),
    });

    timeline.addCustomTime(new Date(flightReplay.currentCursorTime), CURSOR_BAR_ID);

    const syncCursor = ({ time }: { time: Date }) => {
      setCursor(time);
    };

    const jumpCursor = ({ time }: { time?: Date }) => {
      if (!time) {
        return;
      }

      setCursor(time);
    };

    timeline.on("timechange", syncCursor);
    timeline.on("timechanged", syncCursor);
    timeline.on("click", jumpCursor);
    timelineRef.current = timeline;

    return () => {
      timelineRef.current = null;
      timeline.off("timechange", syncCursor);
      timeline.off("timechanged", syncCursor);
      timeline.off("click", jumpCursor);
      timeline.destroy();
    };
  }, [
    flightReplay.flightEnd,
    flightReplay.flightEndMs,
    flightReplay.flightStart,
    flightReplay.flightStartMs,
    flightReplay.packets,
    flightReplay.recoveryEvents,
    flightReplay.stages,
    flightReplay.telemetryConnections,
    setCursor,
  ]);

  useEffect(() => {
    if (!timelineRef.current || !flightReplay.currentCursorTime) return;

    timelineRef.current.setCustomTime(new Date(flightReplay.currentCursorTime), CURSOR_BAR_ID);
  }, [flightReplay.currentCursorTime]);

  useEffect(() => {
    if (!timelineRef.current) return;

    timelineRef.current.setOptions({ height: props.api.height });
  }, [props.api.height]);

  return <div className="w-full h-full" ref={ref} />;
};
