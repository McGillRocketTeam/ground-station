import type { NamedObjectId, Value } from "@mrt/yamcs-effect";

import { Graph } from "effect";

export const MAX_PRESSURE_PSI = 900;

export type ValveId = "V-22" | "V-23";

export interface YamcsMetadata {
  readonly id: typeof NamedObjectId.Type;
  readonly toValue?: (valuePsi: number) => Value;
}

export interface GasNode {
  readonly name: string;
  readonly volume: number;
  readonly fixedPressurePsi?: number;
  readonly sensorTag?: string;
  readonly yamcs?: YamcsMetadata;
}

export interface GasEdge {
  readonly name: string;
  readonly conductance: number;
  readonly valveId?: ValveId;
  readonly yamcs?: YamcsMetadata;
}

export interface GasSystem {
  readonly graph: Graph.UndirectedGraph<GasNode, GasEdge>;
  readonly nodes: {
    readonly tank: Graph.NodeIndex;
    readonly preFillPressure: Graph.NodeIndex;
    readonly split: Graph.NodeIndex;
    readonly postFillPressure: Graph.NodeIndex;
    readonly environment: Graph.NodeIndex;
  };
}

export interface SimulationState {
  readonly pressuresPsi: Map<Graph.NodeIndex, number>;
  readonly valveOpenFraction: Map<ValveId, number>;
}
