import type { BuiltInEdge, Edge, Node } from "@xyflow/react";

export type RadioLinkNodeData = {
  qualifiedName: string;
  friendlyName: string;
  textPosition: "top" | "bottom";
};

export type RadioLinkNode = Node<RadioLinkNodeData, "radioLink">;
export type GroundStationNode = Node<{}, "groundStation">;

export type CustomNodeType = RadioLinkNode | GroundStationNode;
export type CustomEdgeType = Edge<{}, "link"> | BuiltInEdge;

export const initialNodes: CustomNodeType[] = [
  {
    type: "radioLink",
    id: "SystemA/Pad/Radio",
    position: { x: 0, y: 0 },
    data: {
      qualifiedName: "SystemA/Pad/Radio",
      friendlyName: "System A\nPad Radio",
      textPosition: "top",
    },
  },
  {
    type: "radioLink",
    id: "SystemB/Pad/Radio",
    position: { x: 250, y: 0 },
    data: {
      qualifiedName: "SystemB/Pad/Radio",
      friendlyName: "System B\nPad Radio",
      textPosition: "top",
    },
  },
  {
    type: "radioLink",
    id: "SystemA/ControlStation/Radio",
    position: { x: 0, y: 400 },
    data: {
      qualifiedName: "SystemA/ControlStation/Radio",
      friendlyName: "System A\nControl Station\nRadio",
      textPosition: "bottom",
    },
  },
  {
    type: "radioLink",
    id: "SystemB/ControlStation/Radio",
    position: { x: 250, y: 400 },
    data: {
      qualifiedName: "SystemB/ControlStation/Radio",
      friendlyName: "System B\nControl Station\nRadio",
      textPosition: "bottom",
    },
  },
  {
    type: "groundStation",
    id: "groundStation",
    position: { x: 125, y: 225 },
    data: {},
  },
];

export const initialEdges: CustomEdgeType[] = [
  {
    id: "SystemA/Pad/Radio->groundStation",
    source: "SystemA/Pad/Radio",
    sourceHandle: "bottom",
    target: "groundStation",
    targetHandle: "left-top",
    type: "link",
  },
  {
    id: "SystemB/Pad/Radio->groundStation",
    source: "SystemB/Pad/Radio",
    sourceHandle: "bottom",
    target: "groundStation",
    targetHandle: "right-top",
    type: "link",
  },
  {
    id: "SystemA/ControlStation/Radio->groundStation",
    source: "SystemA/ControlStation/Radio",
    sourceHandle: "top",
    target: "groundStation",
    targetHandle: "left-bottom",
    type: "link",
  },
  {
    id: "SystemB/ControlStation/Radio->groundStation",
    source: "SystemB/ControlStation/Radio",
    sourceHandle: "top",
    target: "groundStation",
    targetHandle: "right-bottom",
    type: "link",
  },
];
