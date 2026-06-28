import type { BuiltInEdge, Edge, Node } from "@xyflow/react";

export type RadioLinkNodeData = {
  qualifiedName: string;
  friendlyName: string;
  textPosition: "top" | "bottom" | "right";
};

export type LinkEdgeData = {
  qualifiedName?: string;
};

export type WifiAntennaEdgeData = {
  sourceQualifiedName: string;
  connectedStationsLinkName: string;
  flip?: boolean;
};

export type RadioLinkNode = Node<RadioLinkNodeData, "radioLink">;
export type GroundStationNode = Node<{}, "groundStation">;

export type CustomNodeType = RadioLinkNode | GroundStationNode;
export type CustomEdgeType =
  | Edge<LinkEdgeData, "link">
  | Edge<WifiAntennaEdgeData, "wifiAntenna">
  | BuiltInEdge;

export const initialNodes: CustomNodeType[] = [
  {
    type: "radioLink",
    id: "LabJack",
    position: { x: 125, y: -80 },
    data: {
      qualifiedName: "LabJack",
      friendlyName: "LabJack\nT7",
      textPosition: "top",
    },
  },
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
    id: "EGSE/Pad/WifiAntenna",
    position: { x: 125, y: 180 },
    data: {
      qualifiedName: "EGSE/Pad/WifiAntenna",
      friendlyName: "Pad WiFi\nAntenna",
      textPosition: "right",
    },
  },
  {
    type: "radioLink",
    id: "EGSE/ControlStation/WifiAntenna",
    position: { x: 125, y: 360 },
    data: {
      qualifiedName: "EGSE/ControlStation/WifiAntenna",
      friendlyName: "CS WiFi\nAntenna",
      textPosition: "right",
    },
  },
  {
    type: "radioLink",
    id: "SystemA/ControlStation/Radio",
    position: { x: 0, y: 720 },
    data: {
      qualifiedName: "SystemA/ControlStation/Radio",
      friendlyName: "System A\nControl Station\nRadio",
      textPosition: "bottom",
    },
  },
  {
    type: "groundStation",
    id: "groundStation",
    position: { x: 125, y: 540 },
    data: {},
  },
  {
    type: "radioLink",
    id: "SystemB/ControlStation/Radio",
    position: { x: 250, y: 720 },
    data: {
      qualifiedName: "SystemB/ControlStation/Radio",
      friendlyName: "System B\nControl Station\nRadio",
      textPosition: "bottom",
    },
  },
];

export const initialEdges: CustomEdgeType[] = [
  {
    id: "SystemA/Pad/Radio->EGSE/Pad/WifiAntenna",
    source: "SystemA/Pad/Radio",
    sourceHandle: "bottom",
    target: "EGSE/Pad/WifiAntenna",
    targetHandle: "left",
    type: "link",
  },
  {
    id: "SystemB/Pad/Radio->EGSE/Pad/WifiAntenna",
    source: "SystemB/Pad/Radio",
    sourceHandle: "bottom",
    target: "EGSE/Pad/WifiAntenna",
    targetHandle: "right",
    type: "link",
  },
  {
    id: "LabJack->EGSE/Pad/WifiAntenna",
    source: "LabJack",
    sourceHandle: "bottom",
    target: "EGSE/Pad/WifiAntenna",
    targetHandle: "top",
    type: "link",
  },
  {
    id: "EGSE/Pad/WifiAntenna->EGSE/ControlStation/WifiAntenna",
    source: "EGSE/Pad/WifiAntenna",
    sourceHandle: "bottom",
    target: "EGSE/ControlStation/WifiAntenna",
    targetHandle: "top",
    type: "wifiAntenna",
    data: {
      sourceQualifiedName: "EGSE/Pad/WifiAntenna",
      connectedStationsLinkName: "EGSE/ControlStation/WifiAntenna",
    },
  },
  {
    id: "SystemA/ControlStation/Radio->groundStation",
    source: "SystemA/ControlStation/Radio",
    sourceHandle: "top",
    target: "groundStation",
    targetHandle: "left",
    type: "link",
  },
  {
    id: "SystemB/ControlStation/Radio->groundStation",
    source: "SystemB/ControlStation/Radio",
    sourceHandle: "top",
    target: "groundStation",
    targetHandle: "right",
    type: "link",
  },
  {
    id: "groundStation->EGSE/ControlStation/WifiAntenna",
    source: "groundStation",
    sourceHandle: "top",
    target: "EGSE/ControlStation/WifiAntenna",
    targetHandle: "bottom",
    type: "wifiAntenna",
    data: {
      flip: true,
      sourceQualifiedName: "EGSE/ControlStation/WifiAntenna",
      connectedStationsLinkName: "EGSE/ControlStation/WifiAntenna",
    },
  },
];
