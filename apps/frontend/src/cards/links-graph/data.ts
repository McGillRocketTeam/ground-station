import type { BuiltInEdge, Edge, Node } from "@xyflow/react";

export type RadioLinkNodeData = {
  qualifiedName: string;
  friendlyName: string;
  textPosition: "top" | "bottom" | "right";
  kind?: "bridge" | "radio" | "switch";
};

export type LinkEdgeData = {
  qualifiedName?: string;
};

export type BeamBridgeEdgeData = {
  connectedParameter: string;
  flip?: boolean;
};

export type RadioLinkNode = Node<RadioLinkNodeData, "radioLink">;
export type GroundStationNode = Node<{}, "groundStation">;

export type CustomNodeType = RadioLinkNode | GroundStationNode;
export type CustomEdgeType =
  | Edge<LinkEdgeData, "link">
  | Edge<BeamBridgeEdgeData, "beamBridge">
  | BuiltInEdge;

export const initialNodes: CustomNodeType[] = [
  {
    type: "radioLink",
    id: "LabJack",
    position: { x: 125, y: -80 },
    data: {
      qualifiedName: "EGSE/Pad/LabJack",
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
    id: "EGSE/Pad/BeamBridge",
    position: { x: 125, y: 300 },
    data: {
      qualifiedName: "EGSE/Pad/BeamBridge",
      friendlyName: "Beam Bridge\nClient AP",
      textPosition: "right",
      kind: "bridge",
    },
  },
  {
    type: "radioLink",
    id: "EGSE/Pad/OmadaSwitch",
    position: { x: 125, y: 160 },
    data: {
      qualifiedName: "EGSE/Pad/OmadaSwitch",
      friendlyName: "Pad Omada\nSwitch",
      textPosition: "right",
      kind: "switch",
    },
  },
  {
    type: "radioLink",
    id: "EGSE/ControlStation/BeamBridge",
    position: { x: 125, y: 460 },
    data: {
      qualifiedName: "EGSE/ControlStation/BeamBridge",
      friendlyName: "Beam Bridge\nMain AP",
      textPosition: "right",
      kind: "bridge",
    },
  },
  {
    type: "radioLink",
    id: "EGSE/ControlStation/OmadaSwitch",
    position: { x: 125, y: 600 },
    data: {
      qualifiedName: "EGSE/ControlStation/OmadaSwitch",
      friendlyName: "CS Omada\nSwitch",
      textPosition: "right",
      kind: "switch",
    },
  },
  {
    type: "radioLink",
    id: "SystemA/ControlStation/Radio",
    position: { x: 0, y: 760 },
    data: {
      qualifiedName: "SystemA/ControlStation/Radio",
      friendlyName: "System A\nControl Station\nRadio",
      textPosition: "bottom",
    },
  },
  {
    type: "groundStation",
    id: "groundStation",
    position: { x: 125, y: 760 },
    data: {},
  },
  {
    type: "radioLink",
    id: "SystemB/ControlStation/Radio",
    position: { x: 250, y: 760 },
    data: {
      qualifiedName: "SystemB/ControlStation/Radio",
      friendlyName: "System B\nControl Station\nRadio",
      textPosition: "bottom",
    },
  },
];

export const initialEdges: CustomEdgeType[] = [
  {
    id: "SystemA/Pad/Radio->EGSE/Pad/OmadaSwitch",
    source: "SystemA/Pad/Radio",
    sourceHandle: "bottom",
    target: "EGSE/Pad/OmadaSwitch",
    targetHandle: "left",
    type: "link",
  },
  {
    id: "SystemB/Pad/Radio->EGSE/Pad/OmadaSwitch",
    source: "SystemB/Pad/Radio",
    sourceHandle: "bottom",
    target: "EGSE/Pad/OmadaSwitch",
    targetHandle: "right",
    type: "link",
  },
  {
    id: "LabJack->EGSE/Pad/OmadaSwitch",
    source: "LabJack",
    sourceHandle: "bottom",
    target: "EGSE/Pad/OmadaSwitch",
    targetHandle: "top",
    type: "link",
  },
  {
    id: "EGSE/Pad/OmadaSwitch->EGSE/Pad/BeamBridge",
    source: "EGSE/Pad/OmadaSwitch",
    sourceHandle: "bottom",
    target: "EGSE/Pad/BeamBridge",
    targetHandle: "top",
    type: "link",
  },
  {
    id: "EGSE/Pad/BeamBridge->EGSE/ControlStation/BeamBridge",
    source: "EGSE/Pad/BeamBridge",
    sourceHandle: "bottom",
    target: "EGSE/ControlStation/BeamBridge",
    targetHandle: "top",
    type: "beamBridge",
    data: {
      connectedParameter: "/EGSE/Pad/BeamBridge/bridge_connected",
    },
  },
  {
    id: "EGSE/ControlStation/BeamBridge->EGSE/ControlStation/OmadaSwitch",
    source: "EGSE/ControlStation/BeamBridge",
    sourceHandle: "bottom",
    target: "EGSE/ControlStation/OmadaSwitch",
    targetHandle: "top",
    type: "link",
  },
  {
    id: "EGSE/ControlStation/OmadaSwitch->SystemA/ControlStation/Radio",
    source: "EGSE/ControlStation/OmadaSwitch",
    sourceHandle: "bottom",
    target: "SystemA/ControlStation/Radio",
    targetHandle: "top",
    type: "link",
    data: { qualifiedName: "SystemA/ControlStation/Radio" },
  },
  {
    id: "EGSE/ControlStation/OmadaSwitch->groundStation",
    source: "EGSE/ControlStation/OmadaSwitch",
    sourceHandle: "bottom",
    target: "groundStation",
    targetHandle: "top",
    type: "link",
  },
  {
    id: "EGSE/ControlStation/OmadaSwitch->SystemB/ControlStation/Radio",
    source: "EGSE/ControlStation/OmadaSwitch",
    sourceHandle: "bottom",
    target: "SystemB/ControlStation/Radio",
    targetHandle: "top",
    type: "link",
    data: { qualifiedName: "SystemB/ControlStation/Radio" },
  },
];
