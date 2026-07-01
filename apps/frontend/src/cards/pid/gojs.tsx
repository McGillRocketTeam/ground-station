import { useAtomSet, useAtomSubscribe } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import go from "gojs";
import { ReactDiagram } from "gojs-react";
import { useEffect, useMemo, useRef } from "react";

import {
  initialPIDLinkDataArray,
  initialPIDNodeDataArray,
  type LinkData,
  type NodeData,
  type PressureTankNode,
  type ReadoutNode,
  type ValveNode,
  pidDiagramStateAtom,
  togglePIDValveAtom,
} from "./data";

const C = Object.freeze({
  panel: "#b6b6b6",
  panel2: "#c2c2c2",
  panelDk: "#a9a9a9",
  outline: "#7a7a7a",
  pipe: "#8c8c8c",
  text: "#2f2f2f",
  text2: "#5a5a5a",
  on: "#f4f4f4",
  off: "#6b6b6b",
  band: "#9fb3c0",
  level: "#a7bac6",
  track: "#bdbdbd",
  p1: "#e12c2c",
  p2: "#f2b134",
  p3: "#46c2e0",
});

const PRESSURE_TANK_WIDTH = 90;
const PRESSURE_TANK_HEIGHT = 120;
const PRESSURE_TANK_FILL_INSET = 6;
const PRESSURE_TANK_PORT_INSET = 20;

type DiagramModel = go.GraphLinksModel<NodeData, LinkData>;

type PIDDiagramHandle = ReactDiagram & {
  getDiagram(): go.Diagram | null;
};

function getDiagramModel(diagram: go.Diagram): DiagramModel {
  return diagram.model as unknown as DiagramModel;
}

function syncDiagramModel(
  diagram: go.Diagram,
  next: { nodeDataArray: Array<NodeData>; linkDataArray: Array<LinkData> },
) {
  const model = getDiagramModel(diagram);

  model.commit(() => {
    for (const node of next.nodeDataArray) {
      const current = model.findNodeDataForKey(node.key);

      if (!current) {
        model.addNodeData(node);
        continue;
      }

      for (const [key, value] of Object.entries(node)) {
        if ((current as Record<string, unknown>)[key] !== value) {
          model.set(current, key, value);
        }
      }
    }

    for (const link of next.linkDataArray) {
      const current = model.findLinkDataForKey(link.key);

      if (!current) {
        model.addLinkData(link);
        continue;
      }

      for (const [key, value] of Object.entries(link)) {
        if ((current as Record<string, unknown>)[key] !== value) {
          model.set(current, key, value);
        }
      }
    }
  }, "sync pid state");
}

function toggleValve(
  toggleValveInProgram: (key: string) => void,
  _e: go.InputEvent,
  obj: go.GraphObject,
) {
  const node = obj.part;
  if (!(node instanceof go.Node)) return;

  const data = node.data as NodeData | undefined;
  if (!data || (data.category !== "valve" && data.category !== "ball-valve")) return;

  toggleValveInProgram(data.key);
}

function makeTankTemplate() {
  const tankWidth = 90;
  const tankHeight = 120;

  return new go.Node("Spot", {
    locationObjectName: "BODY",
    locationSpot: go.Spot.Center,
    selectable: false,
  })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        name: "BODY",
        width: tankWidth,
        height: tankHeight,
        fill: C.on,
        stroke: C.outline,
        strokeWidth: 1.5,
        portId: "",
        fromSpot: go.Spot.Top,
        toSpot: go.Spot.Top,
      }),
      new go.TextBlock({
        alignment: new go.Spot(0.5, 0, 0, tankHeight * 0.4),
        stroke: C.text,
      }).bind("text", "label"),
    );
}

function makePressureTankTemplate() {
  const fillHeight = PRESSURE_TANK_HEIGHT - PRESSURE_TANK_FILL_INSET;

  return new go.Node("Spot", {
    locationObjectName: "BODY",
    locationSpot: go.Spot.Center,
    selectable: false,
  })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        name: "BODY",
        width: PRESSURE_TANK_WIDTH,
        height: PRESSURE_TANK_HEIGHT,
        fill: C.on,
        stroke: C.outline,
        strokeWidth: 1.5,
        portId: "",
        fromSpot: go.Spot.Top,
        toSpot: go.Spot.Top,
      }),
      new go.Shape("Rectangle", {
        width: PRESSURE_TANK_WIDTH - PRESSURE_TANK_FILL_INSET,
        fill: C.level,
        strokeWidth: 0,
        alignment: new go.Spot(0.5, 1, 0, -3),
        alignmentFocus: go.Spot.Bottom,
      }).bind("height", "value", (value: number | undefined, obj: go.GraphObject) => {
        const data = obj.part?.data as PressureTankNode | undefined;
        const min = data?.min ?? 0;
        const max = data?.max ?? 900;
        const span = Math.max(1, max - min);
        const clamped = Math.max(min, Math.min(value ?? 0, max));
        return ((clamped - min) / span) * fillHeight;
      }),
      new go.TextBlock({
        alignment: new go.Spot(0.5, 0, 0, 16),
        stroke: C.text,
      }).bind("text", "label"),
      new go.TextBlock({
        alignment: go.Spot.Center,
        font: "12px 'B612 Mono'",
        spacingAbove: 2,
        spacingBelow: 2,
        stroke: C.text,
        width: 7 * 8,
        textAlign: "center",
      }).bind("text", "value", (value: number | undefined, obj: go.GraphObject) => {
        const data = obj.part?.data as PressureTankNode | undefined;
        const min = data?.min ?? 0;
        const whole = Math.max(min, Math.round(value ?? 0));
        return data?.unit
          ? `${whole.toString().padStart(4, " ")} ${data.unit}`
          : whole.toString().padStart(4, " ");
      }),
      new go.Shape("Circle", {
        width: 0,
        height: 0,
        opacity: 0,
        strokeWidth: 0,
        portId: "LeftTop",
        fromSpot: go.Spot.Left,
        toSpot: go.Spot.Left,
        alignment: new go.Spot(0, 0, 0, PRESSURE_TANK_PORT_INSET),
        alignmentFocus: go.Spot.Center,
      }),
      new go.Shape("Circle", {
        width: 0,
        height: 0,
        opacity: 0,
        strokeWidth: 0,
        portId: "LeftBottom",
        fromSpot: go.Spot.Left,
        toSpot: go.Spot.Left,
        alignment: new go.Spot(0, 1, 0, -PRESSURE_TANK_PORT_INSET),
        alignmentFocus: go.Spot.Center,
      }),
      new go.Shape("Circle", {
        width: 0,
        height: 0,
        opacity: 0,
        strokeWidth: 0,
        portId: "RightTop",
        fromSpot: go.Spot.Right,
        toSpot: go.Spot.Right,
        alignment: new go.Spot(1, 0, 0, PRESSURE_TANK_PORT_INSET),
        alignmentFocus: go.Spot.Center,
      }),
      new go.Shape("Circle", {
        width: 0,
        height: 0,
        opacity: 0,
        strokeWidth: 0,
        portId: "RightBottom",
        fromSpot: go.Spot.Right,
        toSpot: go.Spot.Right,
        alignment: new go.Spot(1, 1, 0, -PRESSURE_TANK_PORT_INSET),
        alignmentFocus: go.Spot.Center,
      }),
    );
}

function makeReadoutTemplate() {
  return new go.Node("Auto", {
    selectable: false,
    locationSpot: go.Spot.Top,
  })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        fill: C.panel2,
        stroke: C.outline,
        strokeWidth: 0.75,
      }),
      new go.Panel("Vertical", {
        margin: new go.Margin(3, 6),
        defaultAlignment: go.Spot.Left,
      }).add(
        new go.TextBlock({ font: "bold 9px sans-serif", stroke: C.text }).bind("text", "label"),
        new go.Panel("Horizontal", { margin: new go.Margin(4, 0, 0, 0) }).add(
          new go.TextBlock({ font: "15px 'B612 Mono'", stroke: C.text }).bind(
            "text",
            "value",
            (value: number | undefined, obj: go.GraphObject) => {
              const data = obj.part?.data as ReadoutNode | undefined;
              return (value ?? 0).toFixed(data?.decimals ?? 0);
            },
          ),
          new go.TextBlock({
            font: "9px 'B612 Mono'",
            stroke: C.text2,
            margin: new go.Margin(0, 0, 0, 3),
          }).bind("text", "unit", (unit?: string) => unit ?? ""),
        ),
      ),
    );
}

function labelAlignmentForAngle(angle?: number) {
  switch ((((angle ?? 0) % 360) + 360) % 360) {
    case 90:
      return new go.Spot(1, 0.5, 18, 0);
    case 180:
      return new go.Spot(0.5, 0, 0, -12);
    case 270:
      return new go.Spot(0, 0.5, -18, 0);
    default:
      return new go.Spot(0.5, 1, 0, 12);
  }
}

function ballValveLabelAlignmentForAngle(angle?: number) {
  switch ((((angle ?? 0) % 360) + 360) % 360) {
    case 90:
      return new go.Spot(0, 0.5, -18, 0);
    case 180:
      return new go.Spot(0.5, 0, 0, -12);
    case 270:
      return new go.Spot(1, 0.5, 18, 0);
    default:
      return new go.Spot(0.5, 1, 0, 12);
  }
}

function uprightAngle(angle?: number) {
  return -(((angle ?? 0) % 360) + 360) % 360;
}

function initDiagram(toggleValveInProgram: (key: string) => void) {
  const diagram = new go.Diagram({
    initialContentAlignment: go.Spot.Center,
    allowMove: false,
    allowCopy: false,
    allowDelete: false,
    allowSelect: false,
    // "grid.visible": true,
  });

  const model: DiagramModel = new go.GraphLinksModel<NodeData, LinkData>();
  model.nodeKeyProperty = "key";
  model.linkKeyProperty = "key";
  diagram.model = model;

  diagram.nodeTemplate = new go.Node("Auto", { selectable: false })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        width: 60,
        height: 24,
        fill: C.on,
        stroke: C.outline,
        strokeWidth: 1.5,
        portId: "",
        fromSpot: go.Spot.Right,
        toSpot: go.Spot.Left,
      }),
      new go.TextBlock({ margin: 6, stroke: C.text }).bind("text", "key"),
    );

  // Valve
  diagram.nodeTemplateMap.add(
    "valve",
    new go.Node("Spot", {
      locationObjectName: "SHAPE",
      locationSpot: go.Spot.Center,
      selectionObjectName: "SHAPE",
      click: (e, obj) => toggleValve(toggleValveInProgram, e, obj),
      cursor: "pointer",
    })
      .bind("location", "loc", go.Point.parse)
      .add(
        new go.Panel("Spot", { name: "SYMBOL" }).bind("angle", "angle").add(
          new go.Shape({
            name: "SHAPE",
            geometryString: "F1 M0 0 L0 24 L18 12 z M36 0 L36 24 L18 12 z",
            stroke: C.outline,
            strokeWidth: 1.5,
            portId: "",
            fromSpot: go.Spot.Right,
            toSpot: go.Spot.Left,
          }).bind("fill", "state", (state: ValveNode["state"]) =>
            state === "OPEN" ? C.on : C.off,
          ),
        ),
        new go.TextBlock({ stroke: C.text })
          .bind("alignment", "angle", labelAlignmentForAngle)
          .bind("text", "key"),
      ),
  );

  // Ball Valve
  diagram.nodeTemplateMap.add(
    "ball-valve",
    new go.Node("Spot", {
      locationObjectName: "SHAPE",
      locationSpot: go.Spot.Center,
      selectionObjectName: "SHAPE",
      click: (e, obj) => toggleValve(toggleValveInProgram, e, obj),
      cursor: "pointer",
    })
      .bind("location", "loc", go.Point.parse)
      .add(
        new go.Panel("Spot", { name: "SYMBOL" }).bind("angle", "angle").add(
          new go.Shape({
            name: "SHAPE",
            geometryString: "F1 M0 0 L0 24 L18 12 z M36 0 L36 24 L18 12 z",
            stroke: C.outline,
            strokeWidth: 1.5,
            portId: "",
            fromSpot: go.Spot.Right,
            toSpot: go.Spot.Left,
          }).bind("fill", "state", (state: ValveNode["state"]) =>
            state === "OPEN" ? C.on : C.off,
          ),
          new go.Shape({
            geometryString: "M0 0 V26",
            stroke: C.outline,
            strokeWidth: 1.5,
            alignment: new go.Spot(0.5, 0, 0, -15),
            alignmentFocus: go.Spot.Top,
          }),
          new go.Shape("Circle", {
            width: 15,
            height: 15,
            stroke: C.outline,
            strokeWidth: 1.5,
            alignment: go.Spot.Center,
          }).bind("fill", "state", (state: ValveNode["state"]) =>
            state === "OPEN" ? C.on : C.off,
          ),
          new go.Panel("Auto", {
            alignment: new go.Spot(0.5, 0, 0, -14),
            alignmentFocus: go.Spot.Bottom,
          })
            .bind("angle", "angle", uprightAngle)
            .add(
              new go.Shape("Rectangle", {
                width: 16,
                height: 16,
                fill: C.on,
                stroke: C.outline,
                strokeWidth: 1.5,
              }),
              new go.TextBlock({ font: "10px sans-serif", stroke: C.text }).bind(
                "text",
                "letter",
                (letter?: string) => letter ?? "E",
              ),
            ),
        ),
        new go.TextBlock({ stroke: C.text })
          .bind("alignment", "angle", ballValveLabelAlignmentForAngle)
          .bind("text", "key"),
      ),
  );

  diagram.nodeTemplateMap.add("tank", makeTankTemplate());
  diagram.nodeTemplateMap.add("pressure-tank", makePressureTankTemplate());
  diagram.nodeTemplateMap.add("readout", makeReadoutTemplate());

  diagram.nodeTemplateMap.add(
    "pipe-end",
    new go.Node("Spot", {
      selectable: false,
      locationSpot: go.Spot.Center,
    })
      .bind("location", "loc", go.Point.parse)
      .add(
        new go.Shape("Circle", {
          width: 1,
          height: 1,
          opacity: 0,
          strokeWidth: 0,
          portId: "",
          fromSpot: go.Spot.Right,
          toSpot: go.Spot.Left,
        }),
      ),
  );

  diagram.linkTemplate = new go.Link({
    routing: go.Routing.Orthogonal,
    corner: 0,
    selectable: false,
  })
    .bind("fromPortId", "fromPort")
    .bind("toPortId", "toPort")
    .bind("fromSpot", "fromSpot", go.Spot.parse)
    .bind("toSpot", "toSpot", go.Spot.parse)
    .add(new go.Shape({ stroke: C.pipe, strokeWidth: 3 }));

  return diagram;
}

export function PIDDiagram() {
  const diagramRef = useRef<PIDDiagramHandle | null>(null);
  const togglePIDValve = useAtomSet(togglePIDValveAtom);
  const createDiagram = useMemo(() => () => initDiagram(togglePIDValve), [togglePIDValve]);

  useEffect(() => {
    const diagram = diagramRef.current?.getDiagram();
    if (!diagram) {
      return;
    }

    syncDiagramModel(diagram, {
      nodeDataArray: initialPIDNodeDataArray,
      linkDataArray: initialPIDLinkDataArray,
    });
  }, []);

  useAtomSubscribe(
    pidDiagramStateAtom,
    (result) => {
      const diagram = diagramRef.current?.getDiagram();
      if (!diagram) {
        return;
      }

      AsyncResult.match(result, {
        onInitial: () => undefined,
        onFailure: () => undefined,
        onSuccess: ({ value }) => syncDiagramModel(diagram, value),
      });
    },
    { immediate: true },
  );

  return (
    <ReactDiagram
      ref={diagramRef}
      initDiagram={createDiagram}
      divClassName="w-full h-full"
      nodeDataArray={initialPIDNodeDataArray}
      linkDataArray={initialPIDLinkDataArray}
    />
  );
}
