import { useAtomSet, useAtomSubscribe } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import go from "gojs";
import { ReactDiagram } from "gojs-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { resolveTheme, useTheme } from "@/components/theme-provider";

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

type DiagramTheme = ReturnType<typeof getDiagramTheme>;

function getDiagramTheme(theme: "light" | "dark") {
  if (theme === "dark") {
    return Object.freeze({
      panel: "#525252",
      panel2: "#666666",
      panelDk: "#8a8a8a",
      outline: "#ededed",
      pipe: "#a4a4a4",
      text: "#f5f5f5",
      text2: "#d4d4d4",
      on: "#000000",
      off: "#b2b2b2",
      band: "#8a8a8a",
      level: "#74b4c7",
      track: "#9a9a9a",
      p1: "#b3b3b3",
      p2: "#8a8a8a",
      p3: "#666666",
    });
  }

  return Object.freeze({
    panel: "#b6b6b6",
    panel2: "#c2c2c2",
    panelDk: "#a9a9a9",
    outline: "#5c5c5c",
    pipe: "#707070",
    text: "#262626",
    text2: "#525252",
    on: "#fafafa",
    off: "#3d3d3d",
    band: "#9c9c9c",
    level: "#a7bac6",
    track: "#bdbdbd",
    p1: "#9c9c9c",
    p2: "#777777",
    p3: "#595959",
  });
}

const PRESSURE_TANK_WIDTH = 90;
const PRESSURE_TANK_HEIGHT = 120;
const PRESSURE_TANK_FILL_INSET = 6;
const PRESSURE_TANK_PORT_INSET = 20;

type DiagramModel = go.GraphLinksModel<NodeData, LinkData>;

type PIDDiagramHandle = ReactDiagram & {
  getDiagram(): go.Diagram | null;
};

function fitDiagramToViewport(diagram: go.Diagram) {
  const host = diagram.div;
  if (!host || host.clientWidth === 0 || host.clientHeight === 0) {
    return false;
  }

  const { width, height } = diagram.documentBounds;
  if (width === 0 || height === 0) {
    return false;
  }

  diagram.zoomToFit();
  return true;
}

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

function makeTankTemplate(colors: DiagramTheme) {
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
        fill: colors.on,
        stroke: colors.outline,
        strokeWidth: 1.5,
        portId: "",
        fromSpot: go.Spot.Top,
        toSpot: go.Spot.Top,
      }),
      new go.TextBlock({
        alignment: new go.Spot(0.5, 0, 0, tankHeight * 0.4),
        stroke: colors.text,
      }).bind("text", "label"),
    );
}

function makePressureTankTemplate(colors: DiagramTheme) {
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
        fill: colors.on,
        stroke: colors.outline,
        strokeWidth: 1.5,
        portId: "",
        fromSpot: go.Spot.Top,
        toSpot: go.Spot.Top,
      }),
      new go.Shape("Rectangle", {
        width: PRESSURE_TANK_WIDTH - PRESSURE_TANK_FILL_INSET,
        fill: colors.level,
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
        stroke: colors.text,
      }).bind("text", "label"),
      new go.TextBlock({
        alignment: go.Spot.Center,
        font: "12px 'B612 Mono'",
        spacingAbove: 2,
        spacingBelow: 2,
        stroke: colors.text,
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

function makeReadoutTemplate(colors: DiagramTheme) {
  return new go.Node("Auto", {
    selectable: false,
    locationSpot: go.Spot.Top,
  })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        fill: colors.panel2,
        stroke: colors.outline,
        strokeWidth: 0.75,
      }),
      new go.Panel("Vertical", {
        margin: new go.Margin(3, 6),
        defaultAlignment: go.Spot.Left,
      }).add(
        new go.TextBlock({ font: "bold 9px sans-serif", stroke: colors.text }).bind(
          "text",
          "label",
        ),
        new go.Panel("Horizontal", { margin: new go.Margin(4, 0, 0, 0) }).add(
          new go.TextBlock({ font: "15px 'B612 Mono'", stroke: colors.text }).bind(
            "text",
            "value",
            (value: number | undefined, obj: go.GraphObject) => {
              const data = obj.part?.data as ReadoutNode | undefined;
              return (value ?? 0).toFixed(data?.decimals ?? 0);
            },
          ),
          new go.TextBlock({
            font: "9px 'B612 Mono'",
            stroke: colors.text2,
            margin: new go.Margin(0, 0, 0, 3),
          }).bind("text", "unit", (unit?: string) => unit ?? ""),
        ),
      ),
    );
}

function makeDashedRectangleTemplate(colors: DiagramTheme) {
  return new go.Node("Spot", {
    selectable: false,
    locationSpot: go.Spot.TopLeft,
  })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        fill: null,
        stroke: colors.outline,
        strokeWidth: 1.5,
        strokeDashArray: [5, 3],
        alignment: go.Spot.Center,
      })
        .bind("width", "width")
        .bind("height", "height"),
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
      return new go.Spot(0, 0.5, -22, 0);
    case 180:
      return new go.Spot(0.5, 0, 0, -20);
    case 270:
      return new go.Spot(1, 0.5, 22, 0);
    default:
      return new go.Spot(0.5, 1, 0, 20);
  }
}

function chevronLabelAlignmentForAngle(angle?: number) {
  switch ((((angle ?? 0) % 360) + 360) % 360) {
    case 90:
      return new go.Spot(0.5, 0, 0, -12);
    case 180:
      return new go.Spot(1, 0.5, 28, 0);
    case 270:
      return new go.Spot(0.5, 1, 0, 12);
    default:
      return new go.Spot(0, 0.5, -28, 0);
  }
}

function chevronLabelAlignmentFocusForAngle(angle?: number) {
  switch ((((angle ?? 0) % 360) + 360) % 360) {
    case 90:
      return go.Spot.Bottom;
    case 180:
      return go.Spot.Left;
    case 270:
      return go.Spot.Top;
    default:
      return go.Spot.Right;
  }
}

function uprightAngle(angle?: number) {
  return -(((angle ?? 0) % 360) + 360) % 360;
}

function hasValveLetter(node?: NodeData) {
  return (
    (node?.category === "valve" || node?.category === "ball-valve") && Object.hasOwn(node, "letter")
  );
}

function valveDisplayText(node?: NodeData) {
  return node?.category === "valve" || node?.category === "ball-valve"
    ? (node.label ?? node.key)
    : "";
}

function makeLinkTemplate(shape: go.Shape) {
  return new go.Link({
    routing: go.Routing.Orthogonal,
    corner: 0,
    selectable: false,
  })
    .bind("fromPortId", "fromPort")
    .bind("toPortId", "toPort")
    .bind("fromSpot", "fromSpot", go.Spot.parse)
    .bind("toSpot", "toSpot", go.Spot.parse)
    .add(shape);
}

function initDiagram(toggleValveInProgram: (key: string) => void, colors: DiagramTheme) {
  go.Diagram.licenseKey = import.meta.env.MRT_GOJS_API_KEY;
  const diagram = new go.Diagram({
    initialContentAlignment: go.Spot.Center,
    allowMove: false,
    allowCopy: false,
    allowDelete: false,
    allowSelect: false,
    // "grid.visible": true,
  });

  const model = new go.GraphLinksModel<NodeData, LinkData>();
  model.nodeKeyProperty = "key";
  model.linkKeyProperty = "key";
  diagram.model = model;

  diagram.nodeTemplate = new go.Node("Auto", { selectable: false })
    .bind("location", "loc", go.Point.parse)
    .add(
      new go.Shape("Rectangle", {
        width: 60,
        height: 24,
        fill: colors.on,
        stroke: colors.outline,
        strokeWidth: 1.5,
        portId: "",
        fromSpot: go.Spot.Right,
        toSpot: go.Spot.Left,
      }),
      new go.TextBlock({ margin: 6, stroke: colors.text }).bind("text", "key"),
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
            stroke: colors.outline,
            strokeWidth: 1.5,
            portId: "",
            fromSpot: go.Spot.Right,
            toSpot: go.Spot.Left,
          }).bind("fill", "state", (state: ValveNode["state"]) =>
            state === "OPEN" ? colors.on : colors.off,
          ),
        ),
        new go.TextBlock({ stroke: colors.text, textAlign: "center" })
          .bind("alignment", "angle", labelAlignmentForAngle)
          .bind("text", "key"),
      ),
  );

  // chevron, endpoint for flow
  diagram.nodeTemplateMap.add(
    "chevron",
    new go.Node("Spot", { locationObjectName: "PORT", locationSpot: go.Spot.Right })
      .bind("location", "loc", go.Point.parse)
      .add(
        new go.Shape({
          name: "PORT",
          geometryString: "F1 M0 0 L30 0 L42 10 L30 20 L0 20 z",
          fill: colors.panel2,
          stroke: colors.outline,
          portId: "",
        }).bind("angle", "angle"),
        new go.TextBlock({
          stroke: colors.text,
          textAlign: "center",
          maxSize: new go.Size(80, NaN),
        })
          .bind("text", "label")
          .bind("alignment", "angle", chevronLabelAlignmentForAngle)
          .bind("alignmentFocus", "angle", chevronLabelAlignmentFocusForAngle),
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
            stroke: colors.outline,
            strokeWidth: 1.5,
            portId: "",
            fromSpot: go.Spot.Right,
            toSpot: go.Spot.Left,
          }).bind("fill", "state", (state: ValveNode["state"]) =>
            state === "OPEN" ? colors.on : colors.off,
          ),
          new go.Shape({
            geometryString: "M0 0 V26",
            stroke: colors.outline,
            strokeWidth: 1.5,
            alignment: new go.Spot(0.5, 0, 0, -15),
            alignmentFocus: go.Spot.Top,
          }).bind("visible", "", hasValveLetter),
          new go.Shape("Circle", {
            width: 15,
            height: 15,
            stroke: colors.outline,
            strokeWidth: 1.5,
            alignment: go.Spot.Center,
          }).bind("fill", "state", (state: ValveNode["state"]) =>
            state === "OPEN" ? colors.on : colors.off,
          ),
          new go.Panel("Auto", {
            alignment: new go.Spot(0.5, 0, 0, -14),
            alignmentFocus: go.Spot.Bottom,
          })
            .bind("visible", "", hasValveLetter)
            .bind("angle", "angle", uprightAngle)
            .add(
              new go.Shape("Rectangle", {
                width: 16,
                height: 16,
                fill: colors.on,
                stroke: colors.outline,
                strokeWidth: 1.5,
              }),
              new go.TextBlock({ font: "10px sans-serif", stroke: colors.text }).bind(
                "text",
                "letter",
                (letter?: string) => letter ?? "",
              ),
            ),
        ),
        new go.TextBlock({ stroke: colors.text, textAlign: "center" })
          .bind("alignment", "angle", ballValveLabelAlignmentForAngle)
          .bind("text", "", valveDisplayText),
      ),
  );

  diagram.nodeTemplateMap.add("tank", makeTankTemplate(colors));
  diagram.nodeTemplateMap.add("pressure-tank", makePressureTankTemplate(colors));
  diagram.nodeTemplateMap.add("readout", makeReadoutTemplate(colors));
  diagram.nodeTemplateMap.add("dashed-rectangle", makeDashedRectangleTemplate(colors));

  diagram.nodeTemplateMap.add(
    "pipe-end",
    new go.Node("Spot", {
      selectable: false,
      locationSpot: go.Spot.Center,
    })
      .bind("location", "loc", go.Point.parse)
      .add(
        new go.Shape("Square", {
          width: 3,
          height: 3,
          opacity: 100,
          fill: colors.pipe,
          // fill: "#FF0000",
          strokeWidth: 0,
          portId: "",
          fromSpot: go.Spot.Right,
          toSpot: go.Spot.Left,
        }),
      ),
  );

  diagram.linkTemplate = makeLinkTemplate(new go.Shape({ stroke: colors.pipe, strokeWidth: 3 }));
  diagram.linkTemplateMap.add(
    "dashed",
    makeLinkTemplate(
      new go.Shape({ stroke: colors.panelDk, strokeWidth: 1.5, strokeDashArray: [5, 3] }),
    ),
  );

  return diagram;
}

export function PIDDiagram() {
  const { theme } = useTheme();
  const togglePIDValve = useAtomSet(togglePIDValveAtom);
  const resolvedTheme = resolveTheme(theme);
  const diagramColors = useMemo(() => getDiagramTheme(resolvedTheme), [resolvedTheme]);
  const liveDiagramRef = useRef<go.Diagram | null>(null);
  const detachDiagramRef = useRef<(() => void) | null>(null);
  const latestModelRef = useRef({
    nodeDataArray: initialPIDNodeDataArray,
    linkDataArray: initialPIDLinkDataArray,
  });
  const createDiagram = useMemo(
    () => () => initDiagram(togglePIDValve, diagramColors),
    [diagramColors, togglePIDValve],
  );

  const handleDiagramRef = useCallback((handle: PIDDiagramHandle | null) => {
    detachDiagramRef.current?.();
    detachDiagramRef.current = null;

    const diagram = handle?.getDiagram() ?? null;
    liveDiagramRef.current = diagram;
    if (!diagram) {
      return;
    }

    syncDiagramModel(diagram, latestModelRef.current);

    let frameId = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        diagram.requestUpdate();
        fitDiagramToViewport(diagram);
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });
    const handleInitialLayoutCompleted = () => {
      scheduleFit();
    };

    if (diagram.div) {
      resizeObserver.observe(diagram.div);
    }

    diagram.addDiagramListener("InitialLayoutCompleted", handleInitialLayoutCompleted);
    scheduleFit();

    detachDiagramRef.current = () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      diagram.removeDiagramListener("InitialLayoutCompleted", handleInitialLayoutCompleted);
      if (liveDiagramRef.current === diagram) {
        liveDiagramRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      detachDiagramRef.current?.();
      detachDiagramRef.current = null;
    };
  }, []);

  const handleDiagramState = useCallback(
    (result: AsyncResult.AsyncResult<typeof latestModelRef.current, unknown>) => {
      AsyncResult.match(result, {
        onInitial: () => undefined,
        onFailure: () => undefined,
        onSuccess: ({ value }) => {
          latestModelRef.current = value;

          if (liveDiagramRef.current) {
            syncDiagramModel(liveDiagramRef.current, value);
          }
        },
      });
    },
    [],
  );

  useAtomSubscribe(pidDiagramStateAtom, handleDiagramState, { immediate: true });

  return (
    <ReactDiagram
      key={resolvedTheme}
      ref={handleDiagramRef}
      initDiagram={createDiagram}
      divClassName="w-full h-full"
      nodeDataArray={initialPIDNodeDataArray}
      linkDataArray={initialPIDLinkDataArray}
    />
  );
}
