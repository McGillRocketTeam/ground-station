import { Commands, Parameters } from "@mrt/yamcs-effect";
import { Context, Effect, Layer, PubSub, Stream, SubscriptionRef } from "effect";

import { frontendRuntimeFactory, yamcsSubscriptionRuntime } from "@/lib/atom/yamcs/runtime";

const PRESSURE_TANK_HEIGHT = 120;
const PRESSURE_TANK_PORT_INSET = 20;

const tankLoc = { x: 0, y: 0 } as const;
const leftBottomPortY = tankLoc.y + PRESSURE_TANK_HEIGHT / 2 - PRESSURE_TANK_PORT_INSET + 0.75;
const leftTopPortY = tankLoc.y - PRESSURE_TANK_HEIGHT / 2 + PRESSURE_TANK_PORT_INSET - 0.75;

type BaseNode = {
  key: string;
  loc: string;
};

export type ValveNode = BaseNode & {
  category: "ball-valve" | "valve";
  angle?: number;
  label?: string;
  letter?: string;
  qualifiedName?: string;
  commandQualifiedName?: string;
  state: "OPEN" | "CLOSED";
};

export type ValveState = ValveNode["state"];

export type QualifiedValveNode = ValveNode & {
  qualifiedName: string;
};

export type ValveInteraction = {
  key: string;
  source: "subscription" | "user";
  state: ValveState;
};

export type TankNode = BaseNode & {
  category: "tank";
  label: string;
};

export type PressureTankNode = BaseNode & {
  category: "pressure-tank";
  label: string;
  qualifiedName?: string;
  value?: number;
  unit?: string;
  min?: number;
  max?: number;
};

export type ChevronNode = BaseNode & {
  category: "chevron";
  angle?: number;
  label?: string;
};

export type ReadoutNode = BaseNode & {
  category: "readout";
  label: string;
  qualifiedName?: string;
  value?: number;
  unit?: string;
  decimals?: number;
};

export type TelemetryNode = PressureTankNode | ReadoutNode;

export type QualifiedTelemetryNode = TelemetryNode & {
  qualifiedName: string;
};

export type PipeEndNode = BaseNode & {
  category: "pipe-end";
};

export type DashedRectangleNode = BaseNode & {
  category: "dashed-rectangle";
  width: number;
  height: number;
};

export type NodeData =
  | ValveNode
  | TankNode
  | PressureTankNode
  | ReadoutNode
  | PipeEndNode
  | DashedRectangleNode
  | ChevronNode;

export type LinkData = {
  key: number;
  category?: "dashed";
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  fromSpot: string;
  toSpot: string;
};

export type PIDDiagramModel = {
  nodeDataArray: Array<NodeData>;
  linkDataArray: Array<LinkData>;
};

const initialNodeDataArray: Array<NodeData> = [
  {
    key: "TANK",
    category: "pressure-tank",
    loc: `${tankLoc.x} ${tankLoc.y}`,
    label: "TANK",
    qualifiedName: "/SystemA/Rocket/FlightComputer/tank_pressure",
    min: 0,
    max: 900,
  },
  {
    key: "F/DOV",
    label: "F/DOV\nV-11",
    category: "ball-valve",
    loc: `150 ${leftBottomPortY}`,
    angle: 0,
    letter: " ",
    state: "OPEN",
    qualifiedName: "/SystemA/Rocket/FlightComputer/fdov_open",
  },
  {
    key: "VENT",
    label: "VENT\nV-12",
    category: "ball-valve",
    loc: `${tankLoc.x} -120`,
    angle: 90,
    letter: "S",
    state: "OPEN",
    qualifiedName: "/SystemA/Rocket/FlightComputer/vent_open",
  },
  {
    key: "VENT-SINK",
    category: "chevron",
    loc: `${tankLoc.x} -230`,
    angle: 90,
    label: "Environment",
  },
  { key: "PIPE-MID-6", category: "pipe-end", loc: `${tankLoc.x} -160` },
  {
    key: "MOV",
    label: "MOV\nV-13",
    category: "ball-valve",
    loc: `${tankLoc.x} 120`,
    angle: 90,
    letter: " ",
    state: "CLOSED",
    qualifiedName: "/SystemA/Rocket/FlightComputer/mov_open",
  },
  { key: "MOV-SINK", category: "chevron", loc: `${tankLoc.x} 190`, angle: -90, label: "Exhaust" },
  { key: "PIPE-MID-0", category: "pipe-end", loc: `500 ${leftBottomPortY}` },
  {
    key: "V-23",
    category: "ball-valve",
    loc: "500 -20",
    angle: 90,
    letter: "E",
    state: "OPEN",
    qualifiedName: "/EGSE/Pad/LabJack/dump_valve_open",
  },
  {
    key: "V-23-SINK",
    category: "chevron",
    loc: `500 -80`,
    angle: 90,
  },
  {
    key: "V-24",
    category: "ball-valve",
    loc: "400 -20",
    angle: 90,
    state: "CLOSED",
  },
  {
    key: "V-24-SINK",
    category: "chevron",
    loc: `400 -80`,
    angle: 90,
  },
  { key: "PIPE-MID-3", category: "pipe-end", loc: `450 ${leftBottomPortY}` },
  { key: "PIPE-MID-1", category: "pipe-end", loc: `400 ${leftBottomPortY}` },
  {
    key: "V-22",
    category: "ball-valve",
    loc: `600 ${leftBottomPortY}`,
    angle: 0,
    letter: "E",
    state: "CLOSED",
    qualifiedName: "/EGSE/Pad/LabJack/fill_valve_open",
  },
  {
    key: "V-21",
    category: "ball-valve",
    loc: "710 -20",
    angle: 90,
    state: "CLOSED",
  },
  {
    key: "V-21-SINK",
    category: "chevron",
    loc: `710 -80`,
    angle: 90,
  },
  { key: "PIPE-MID-2", category: "pipe-end", loc: `710 ${leftBottomPortY}` },
  { key: "N2O", category: "tank", label: "N₂O", loc: "860 -60" },
  { key: "PIPE-MID-4", category: "pipe-end", loc: `740 ${leftBottomPortY}` },
  { key: "PIPE-MID-5", category: "pipe-end", loc: `840 ${leftBottomPortY}` },
  {
    key: "TT-I0",
    category: "readout",
    loc: "840 80",
    label: "TT I-0",
    decimals: 0,
    qualifiedName: "/EGSE/Pad/Thermocouple/tc5_temp",
    unit: "C",
  },
  {
    key: "PT-I1",
    category: "readout",
    loc: "740 80",
    label: "PT I-1",
    decimals: 0,
    qualifiedName: "/EGSE/Pad/LabJack/pre_fill_pressure_psi",
  },
  {
    key: "PT-I2",
    category: "readout",
    loc: "450 80",
    label: "PT I-2",
    qualifiedName: "/EGSE/Pad/LabJack/post_fill_pressure_psi",
    decimals: 0,
  },
  {
    key: "TT-I5",
    category: "readout",
    loc: `-120 ${leftBottomPortY - 19}`,
    label: "TT I-5",
    decimals: 0,
    qualifiedName: "/SystemA/Rocket/FlightComputer/tank_temp",
  },
  {
    key: "TT-I3",
    category: "readout",
    loc: `-120 ${leftBottomPortY - 19}`,
    label: "TT I-5",
    decimals: 0,
    qualifiedName: "/SystemA/Rocket/FlightComputer/tank_temp",
  },
  {
    key: "PT-I4",
    category: "readout",
    loc: `-120 ${leftTopPortY - 19}`,
    label: "PT I-4",
    decimals: 0,
    qualifiedName: "/SystemA/Rocket/FlightComputer/tank_pressure",
  },
  {
    key: "TT-I3",
    category: "readout",
    loc: `-120 -179`,
    label: "TT I-3",
    decimals: 0,
    qualifiedName: "/SystemA/Rocket/FlightComputer/vent_temp",
  },
  {
    key: "ROCKET-ZONE",
    category: "dashed-rectangle",
    loc: "-180 -220",
    width: 400,
    height: 400,
  },
];

const initialLinkDataArray: Array<LinkData> = [
  { key: 1, from: "F/DOV", to: "TANK", fromSpot: "Left", toPort: "RightBottom", toSpot: "Right" },
  { key: 2, from: "TANK", to: "MOV", fromSpot: "Bottom", toSpot: "Left" },
  { key: 3, from: "PIPE-MID-1", to: "F/DOV", fromSpot: "Left", toSpot: "Right" },
  { key: 4, from: "PIPE-MID-0", to: "V-23", fromSpot: "Top", toSpot: "Right" },
  { key: 5, from: "PIPE-MID-0", to: "V-22", fromSpot: "Right", toSpot: "Left" },
  { key: 6, from: "N2O", to: "PIPE-MID-5", fromSpot: "Bottom", toSpot: "Right" },
  { key: 7, from: "PIPE-MID-1", to: "V-24", fromSpot: "Top", toSpot: "Right" },
  { key: 8, from: "V-24", to: "PIPE-MID-3", fromSpot: "Right", toSpot: "Left" },
  { key: 9, from: "V-22", to: "PIPE-MID-2", fromSpot: "Right", toSpot: "Left" },
  { key: 10, from: "V-21", to: "PIPE-MID-2", fromSpot: "Right", toSpot: "Top" },
  { key: 11, from: "PIPE-MID-3", to: "PIPE-MID-0", fromSpot: "Right", toSpot: "Left" },
  { key: 12, from: "PIPE-MID-2", to: "PIPE-MID-4", fromSpot: "Right", toSpot: "Left" },
  { key: 13, from: "PIPE-MID-4", to: "PIPE-MID-5", fromSpot: "Right", toSpot: "Left" },
  {
    key: 14,
    from: "PIPE-MID-3",
    to: "PT-I2",
    fromSpot: "Bottom",
    toSpot: "Top",
    category: "dashed",
  },
  {
    key: 15,
    from: "PIPE-MID-4",
    to: "PT-I1",
    fromSpot: "Bottom",
    toSpot: "Top",
    category: "dashed",
  },
  {
    key: 16,
    from: "PIPE-MID-5",
    to: "TT-I0",
    fromSpot: "Bottom",
    toSpot: "Top",
    category: "dashed",
  },
  { key: 17, from: "TANK", to: "VENT", fromSpot: "Top", toSpot: "Right" },
  { key: 18, from: "TT-I5", to: "TANK", fromSpot: "Right", toPort: "LeftBottom", toSpot: "Left" },
  { key: 19, from: "PT-I4", to: "TANK", fromSpot: "Right", toPort: "LeftTop", toSpot: "Left" },
  { key: 20, from: "VENT", to: "PIPE-MID-6", fromSpot: "Left", toSpot: "Bottom" },
  { key: 21, from: "TT-I3", to: "PIPE-MID-6", fromSpot: "Right", toSpot: "Left" },
  { key: 22, from: "MOV", to: "MOV-SINK", fromSpot: "Right", toSpot: "Right" },
  { key: 23, from: "PIPE-MID-6", to: "VENT-SINK", fromSpot: "TOP", toSpot: "Right" },
  { key: 24, from: "V-24", to: "V-24-SINK", fromSpot: "Left", toSpot: "Right" },
  { key: 25, from: "V-23", to: "V-23-SINK", fromSpot: "Left", toSpot: "Right" },
  { key: 26, from: "V-21", to: "V-21-SINK", fromSpot: "Left", toSpot: "Right" },
];

const initialModel: PIDDiagramModel = {
  nodeDataArray: initialNodeDataArray,
  linkDataArray: initialLinkDataArray,
};

export const initialPIDNodeDataArray = initialNodeDataArray;
export const initialPIDLinkDataArray = initialLinkDataArray;

function updateNode(
  nodeDataArray: Array<NodeData>,
  key: string,
  f: (node: NodeData) => NodeData,
): Array<NodeData> {
  let changed = false;

  const next = nodeDataArray.map((node) => {
    if (node.key !== key) {
      return node;
    }

    changed = true;
    return f(node);
  });

  return changed ? next : nodeDataArray;
}

function isQualifiedValveNode(node: NodeData): node is QualifiedValveNode {
  return (
    (node.category === "valve" || node.category === "ball-valve") &&
    typeof node.qualifiedName === "string" &&
    node.qualifiedName.length > 0
  );
}

function isQualifiedTelemetryNode(node: NodeData): node is QualifiedTelemetryNode {
  return (
    (node.category === "readout" || node.category === "pressure-tank") &&
    typeof node.qualifiedName === "string" &&
    node.qualifiedName.length > 0
  );
}

function extractNumericValue(value: { readonly engValue?: unknown; readonly rawValue?: unknown }) {
  const engValue =
    value.engValue && typeof value.engValue === "object" && "value" in value.engValue
      ? value.engValue.value
      : undefined;
  const rawValue =
    value.rawValue && typeof value.rawValue === "object" && "value" in value.rawValue
      ? value.rawValue.value
      : undefined;
  const raw = engValue ?? rawValue;
  const numericValue = Number(raw);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function extractBooleanValue(value: { readonly engValue?: unknown; readonly rawValue?: unknown }) {
  const engValue =
    value.engValue && typeof value.engValue === "object" && "value" in value.engValue
      ? value.engValue.value
      : undefined;
  const rawValue =
    value.rawValue && typeof value.rawValue === "object" && "value" in value.rawValue
      ? value.rawValue.value
      : undefined;
  const raw = engValue ?? rawValue;

  if (typeof raw === "boolean") {
    return raw;
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();

    if (normalized === "high" || normalized === "true") {
      return true;
    }

    if (normalized === "low" || normalized === "false") {
      return false;
    }
  }

  return undefined;
}

function extractUnit(info: {
  readonly type: { readonly unitSet?: ReadonlyArray<{ readonly unit: string }> };
}) {
  return info.type.unitSet?.[0]?.unit;
}

export class PIDData extends Context.Service<
  PIDData,
  {
    readonly state: SubscriptionRef.SubscriptionRef<PIDDiagramModel>;
    readonly getQualifiedValves: Effect.Effect<Array<QualifiedValveNode>>;
    readonly getQualifiedTelemetryNodes: Effect.Effect<Array<QualifiedTelemetryNode>>;
    readonly valveInteractions: Stream.Stream<ValveInteraction>;
    readonly toggleValve: (key: string) => Effect.Effect<void>;
    readonly setValveState: (key: string, state: ValveState) => Effect.Effect<void>;
    readonly setTelemetryValue: (key: string, value: number, unit?: string) => Effect.Effect<void>;
  }
>()("@mrt/frontend/PIDData") {
  static readonly layer = Layer.effect(
    PIDData,
    Effect.gen(function* () {
      const parameters = yield* Parameters;
      const commands = yield* Commands;
      const state = yield* SubscriptionRef.make(initialModel);
      const valveInteractions = yield* PubSub.unbounded<ValveInteraction>();

      const setNode = (key: string, f: (node: NodeData) => NodeData) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          nodeDataArray: updateNode(current.nodeDataArray, key, f),
        }));

      const setValveState = (key: string, valveState: ValveState) =>
        setNode(key, (node) => {
          if (node.category !== "valve" && node.category !== "ball-valve") {
            return node;
          }

          return {
            ...node,
            state: valveState,
          };
        });

      const toggleValve = (key: string) =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const valve = current.nodeDataArray.find(
            (node): node is ValveNode =>
              node.key === key && (node.category === "valve" || node.category === "ball-valve"),
          );

          if (!valve?.commandQualifiedName) {
            return;
          }

          yield* commands
            .send({ qualifiedName: valve.commandQualifiedName })
            .pipe(Effect.scoped, Effect.asVoid, Effect.catch(Effect.logError));
        });

      const setTelemetryValue = (key: string, value: number, unit?: string) =>
        setNode(key, (node) =>
          node.category === "readout" || node.category === "pressure-tank"
            ? {
                ...node,
                value,
                unit,
              }
            : node,
        );

      const getQualifiedValves = Effect.map(SubscriptionRef.get(state), (current) =>
        current.nodeDataArray.filter(isQualifiedValveNode),
      );
      const getQualifiedTelemetryNodes = Effect.map(SubscriptionRef.get(state), (current) =>
        current.nodeDataArray.filter(isQualifiedTelemetryNode),
      );

      const syncValveState = (key: string, valveState: ValveState) =>
        Effect.gen(function* () {
          yield* setValveState(key, valveState);
          const interaction: ValveInteraction = {
            key,
            source: "subscription",
            state: valveState,
          };
          yield* PubSub.publish(valveInteractions, interaction);
        });

      const qualifiedValves = yield* getQualifiedValves;
      const qualifiedTelemetryNodes = yield* getQualifiedTelemetryNodes;

      yield* Effect.forEach(
        qualifiedValves,
        (valve) =>
          Effect.gen(function* () {
            const subscription = yield* parameters.subscribe(valve.qualifiedName);

            yield* Effect.forkScoped(
              subscription.updates.pipe(
                Stream.runForEach(({ value }) => {
                  const isOpen = extractBooleanValue(value);

                  return isOpen === undefined
                    ? Effect.void
                    : syncValveState(valve.key, isOpen ? "OPEN" : "CLOSED");
                }),
              ),
            );
          }),
        { concurrency: "unbounded", discard: true },
      );

      yield* Effect.forEach(
        qualifiedTelemetryNodes,
        (node) =>
          Effect.gen(function* () {
            const subscription = yield* parameters.subscribe(node.qualifiedName);

            yield* Effect.forkScoped(
              subscription.updates.pipe(
                Stream.runForEach(({ info, value }) => {
                  const numericValue = extractNumericValue(value);
                  const unit = extractUnit(info);

                  return numericValue === undefined
                    ? Effect.void
                    : setTelemetryValue(node.key, numericValue, unit);
                }),
              ),
            );
          }),
        { concurrency: "unbounded", discard: true },
      );

      return {
        state,
        getQualifiedValves,
        getQualifiedTelemetryNodes,
        valveInteractions: Stream.fromPubSub(valveInteractions),
        toggleValve,
        setValveState,
        setTelemetryValue,
      };
    }),
  );
}

const pidRuntime = frontendRuntimeFactory((get) =>
  Layer.provideMerge(PIDData.layer, get(yamcsSubscriptionRuntime.layer)),
);

export const pidDiagramStateAtom = pidRuntime.subscriptionRef(
  PIDData.use((pidData) => Effect.succeed(pidData.state)),
);

export const pidValveInteractionsAtom = pidRuntime.atom(
  Stream.unwrap(PIDData.use((pidData) => Effect.succeed(pidData.valveInteractions))),
);

export const togglePIDValveAtom = pidRuntime.fn<string>()((key) =>
  PIDData.use((pidData) => pidData.toggleValve(key)),
);

export const setPIDValveStateAtom = pidRuntime.fn<{ key: string; state: ValveState }>()(
  ({ key, state }) => PIDData.use((pidData) => pidData.setValveState(key, state)),
);
