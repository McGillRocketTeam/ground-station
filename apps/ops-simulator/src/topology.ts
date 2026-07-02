import { Graph } from "effect";

import type { GasEdge, GasNode, GasSystem } from "./domain.ts";

const kuliteRawValueFromPsi = (valuePsi: number) => ({
  type: "DOUBLE" as const,
  value: (valuePsi + 482) / 268.25,
});

export const buildN20FillSystem = (): GasSystem => {
  let tank: Graph.NodeIndex | undefined;
  let preFillPressure: Graph.NodeIndex | undefined;
  let split: Graph.NodeIndex | undefined;
  let postFillPressure: Graph.NodeIndex | undefined;
  let environment: Graph.NodeIndex | undefined;

  const graph = Graph.undirected<GasNode, GasEdge>((mutable) => {
    tank = Graph.addNode(mutable, {
      name: "N20 tank",
      volume: Number.POSITIVE_INFINITY,
      fixedPressurePsi: 900,
    });

    preFillPressure = Graph.addNode(mutable, {
      name: "PT-I1 pre-fill pressure",
      volume: 1.5,
      sensorTag: "PT-I1",
      yamcs: {
        id: { name: "/EGSE/Pad/LabJack/AIN7" },
        toValue: kuliteRawValueFromPsi,
      },
    });

    split = Graph.addNode(mutable, {
      name: "Downstream split",
      volume: 1,
    });

    postFillPressure = Graph.addNode(mutable, {
      name: "PT-I2 post-fill pressure",
      volume: 2.5,
      sensorTag: "PT-I2",
      yamcs: {
        id: { name: "/EGSE/Pad/LabJack/AIN6" },
        toValue: kuliteRawValueFromPsi,
      },
    });

    environment = Graph.addNode(mutable, {
      name: "Environment",
      volume: Number.POSITIVE_INFINITY,
      fixedPressurePsi: 0,
    });

    Graph.addEdge(mutable, tank, preFillPressure, {
      name: "Tank plumbing",
      conductance: 0.18,
    });

    Graph.addEdge(mutable, preFillPressure, split, {
      name: "V-22",
      conductance: 0.1,
      valveId: "V-22",
      yamcs: { id: { name: "/EGSE/Pad/LabJack/FIO0" } },
    });

    Graph.addEdge(mutable, split, postFillPressure, {
      name: "Post-fill branch",
      conductance: 0.08,
    });

    Graph.addEdge(mutable, split, environment, {
      name: "V-23",
      conductance: 0.2,
      valveId: "V-23",
      yamcs: { id: { name: "/EGSE/Pad/LabJack/FIO1" } },
    });
  });

  if (
    tank === undefined ||
    preFillPressure === undefined ||
    split === undefined ||
    postFillPressure === undefined ||
    environment === undefined
  ) {
    throw new Error("Failed to build N20 fill system graph");
  }

  return {
    graph,
    nodes: {
      tank,
      preFillPressure,
      split,
      postFillPressure,
      environment,
    },
  };
};
