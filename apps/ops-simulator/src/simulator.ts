import type { BatchSetParameterValuesRequest, Value } from "@mrt/yamcs-effect";

import { Graph, Option } from "effect";

import {
  MAX_PRESSURE_PSI,
  type GasSystem,
  type SimulationState,
  type ValveId,
  type YamcsMetadata,
} from "./domain.ts";

export interface SensorReading {
  readonly valuePsi: number;
  readonly yamcs?: YamcsMetadata;
}
export interface ValveReading {
  readonly open: number;
  readonly yamcs?: YamcsMetadata;
}

export type YamcsParameterUpdate = (typeof BatchSetParameterValuesRequest.Type.request)[number];

const clampPressure = (pressurePsi: number): number =>
  Math.max(0, Math.min(MAX_PRESSURE_PSI, pressurePsi));

const valveFraction = (state: SimulationState, valveId: ValveId | undefined): number => {
  if (valveId === undefined) {
    return 1;
  }

  return state.valveOpenFraction.get(valveId) ?? 0;
};

export const makeInitialState = (system: GasSystem): SimulationState => {
  const pressuresPsi = new Map<Graph.NodeIndex, number>();

  for (const [nodeIndex, node] of system.graph) {
    pressuresPsi.set(nodeIndex, clampPressure(node.fixedPressurePsi ?? 0));
  }

  return {
    pressuresPsi,
    valveOpenFraction: new Map<ValveId, number>([
      ["V-22", 0],
      ["V-23", 0],
    ]),
  };
};

export const setValve = (
  state: SimulationState,
  valveId: ValveId,
  openFraction: number,
): SimulationState => ({
  ...state,
  valveOpenFraction: new Map(state.valveOpenFraction).set(
    valveId,
    Math.max(0, Math.min(1, openFraction)),
  ),
});

export const stepSimulation = (
  system: GasSystem,
  state: SimulationState,
  dtSeconds: number,
): SimulationState => {
  const nextPressuresPsi = new Map(state.pressuresPsi);
  const netPressureChange = new Map<Graph.NodeIndex, number>();

  for (const [nodeIndex] of system.graph) {
    netPressureChange.set(nodeIndex, 0);
  }

  for (const [, edge] of Graph.edges(system.graph)) {
    const openness = valveFraction(state, edge.data.valveId);
    if (openness <= 0) {
      continue;
    }

    const sourcePressure = state.pressuresPsi.get(edge.source) ?? 0;
    const targetPressure = state.pressuresPsi.get(edge.target) ?? 0;
    const pressureDifference = sourcePressure - targetPressure;
    if (pressureDifference === 0) {
      continue;
    }

    const unconstrainedTransfer = pressureDifference * edge.data.conductance * openness * dtSeconds;
    const limitedTransfer =
      Math.sign(unconstrainedTransfer) *
      Math.min(Math.abs(unconstrainedTransfer), Math.abs(pressureDifference) / 2);

    netPressureChange.set(edge.source, (netPressureChange.get(edge.source) ?? 0) - limitedTransfer);
    netPressureChange.set(edge.target, (netPressureChange.get(edge.target) ?? 0) + limitedTransfer);
  }

  for (const [nodeIndex, node] of system.graph) {
    if (node.fixedPressurePsi !== undefined) {
      nextPressuresPsi.set(nodeIndex, clampPressure(node.fixedPressurePsi));
      continue;
    }

    const currentPressure = state.pressuresPsi.get(nodeIndex) ?? 0;
    const pressureStep = (netPressureChange.get(nodeIndex) ?? 0) / node.volume;
    nextPressuresPsi.set(nodeIndex, clampPressure(currentPressure + pressureStep));
  }

  return {
    ...state,
    pressuresPsi: nextPressuresPsi,
  };
};

export const readParameters = (system: GasSystem, state: SimulationState) => {
  const updates: YamcsParameterUpdate[] = [];

  for (const [nodeIndex, node] of system.graph) {
    if (node.sensorTag === undefined) {
      continue;
    }

    const valuePsi = Number((state.pressuresPsi.get(nodeIndex) ?? 0).toFixed(1));

    if (node.yamcs) {
      updates.push({ id: node.yamcs.id, value: encodeYamcsValue({ valuePsi, yamcs: node.yamcs }) });
    }
  }

  for (const [id, value] of state.valveOpenFraction) {
    const edgeId = Graph.findEdge(system.graph, (e) => e.valveId === id).pipe(
      Option.getOrUndefined,
    );
    if (edgeId === undefined) continue;

    const valve = Graph.getEdge(system.graph, edgeId).pipe(Option.getOrUndefined);
    if (valve === undefined) continue;

    if (valve.data.yamcs) {
      updates.push({
        id: valve.data.yamcs.id,
        value: { type: "STRING", value: value === 1 ? "high" : "low" },
      });
    }
  }

  return updates;
};

const toPressureValue = (valuePsi: number): Value => ({
  type: "DOUBLE",
  value: valuePsi,
});

const encodeYamcsValue = (reading: SensorReading): Value =>
  reading.yamcs?.toValue?.(reading.valuePsi) ?? toPressureValue(reading.valuePsi);
