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
    id: "PAD Wifi Antenna (Client)",
    position: { x: 125, y: 180 },
    data: {
      qualifiedName: "PAD Wifi Antenna (Client)",
      friendlyName: "Pad WiFi\nAntenna",
      textPosition: "right",
    },
  },
  {
    type: "radioLink",
    id: "CS WiFi Antenna (Access Point)",
    position: { x: 125, y: 360 },
    data: {
      qualifiedName: "CS WiFi Antenna (Access Point)",
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
    id: "SystemA/Pad/Radio->PAD Wifi Antenna (Client)",
    source: "SystemA/Pad/Radio",
    sourceHandle: "bottom",
    target: "PAD Wifi Antenna (Client)",
    targetHandle: "left",
    type: "link",
  },
  {
    id: "SystemB/Pad/Radio->PAD Wifi Antenna (Client)",
    source: "SystemB/Pad/Radio",
    sourceHandle: "bottom",
    target: "PAD Wifi Antenna (Client)",
    targetHandle: "right",
    type: "link",
  },
  {
    id: "PAD Wifi Antenna (Client)->CS WiFi Antenna (Access Point)",
    source: "PAD Wifi Antenna (Client)",
    sourceHandle: "bottom",
    target: "CS WiFi Antenna (Access Point)",
    targetHandle: "top",
    type: "wifiAntenna",
    data: {
      sourceQualifiedName: "PAD Wifi Antenna (Client)",
      connectedStationsLinkName: "CS WiFi Antenna (Access Point)",
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
    id: "groundStation->CS WiFi Antenna (Access Point)",
    source: "groundStation",
    sourceHandle: "top",
    target: "CS WiFi Antenna (Access Point)",
    targetHandle: "bottom",
    type: "wifiAntenna",
    data: {
      flip: true,
      sourceQualifiedName: "CS WiFi Antenna (Access Point)",
      connectedStationsLinkName: "CS WiFi Antenna (Access Point)",
    },
  },
];
