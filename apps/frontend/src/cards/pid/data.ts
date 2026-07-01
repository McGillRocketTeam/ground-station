import { Commands, Parameters } from "@mrt/yamcs-effect";
import { Context, Effect, Layer, PubSub, Stream, SubscriptionRef } from "effect";

import { frontendRuntimeFactory, yamcsSubscriptionRuntime } from "@/lib/atom/yamcs/runtime";

const PRESSURE_TANK_HEIGHT = 120;
const PRESSURE_TANK_PORT_INSET = 20;

const tankLoc = { x: 850, y: -50 } as const;
const leftBottomPortY = tankLoc.y + PRESSURE_TANK_HEIGHT / 2 - PRESSURE_TANK_PORT_INSET;

type BaseNode = {
  key: string;
  loc: string;
};

export type ValveNode = BaseNode & {
  category: "ball-valve" | "valve";
  angle?: number;
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

export type NodeData = ValveNode | TankNode | PressureTankNode | ReadoutNode | PipeEndNode;

export type LinkData = {
  key: number;
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
  { key: "N2O", category: "tank", label: "N₂O", loc: "-20 0" },
  { key: "V-21", category: "valve", loc: "100 40", angle: 90, state: "OPEN" },
  { key: "V-22", category: "ball-valve", loc: "260 140", angle: 0, letter: "E", state: "OPEN" },
  { key: "V-23", category: "ball-valve", loc: "360 40", angle: 90, letter: "E", state: "OPEN" },
  { key: "V-24", category: "valve", loc: "460 40", angle: 90, state: "OPEN" },
  {
    key: "TT-I0",
    category: "readout",
    loc: "40 180",
    label: "TT I-0",
    decimals: 0,
  },
  {
    key: "PT-I1",
    category: "readout",
    loc: "160 180",
    label: "PT I-1",
    decimals: 0,
  },
  {
    key: "PT-I2",
    category: "readout",
    loc: "410 180",
    label: "PT I-2",
    qualifiedName: "/SystemA/Rocket/FlightComputer/tank_pressure",
    decimals: 0,
  },
  { key: "PIPE-MID-0", category: "pipe-end", loc: "40 140" },
  { key: "PIPE-MID-1", category: "pipe-end", loc: "160 140" },
  { key: "PIPE-MID-2", category: "pipe-end", loc: "410 140" },
  { key: "PIPE-END-1", category: "pipe-end", loc: "500 140" },
  { key: "PIPE-END-2", category: "pipe-end", loc: "100 140" },
  { key: "PIPE-END-3", category: "pipe-end", loc: "360 140" },
  { key: "PIPE-END-4", category: "pipe-end", loc: "460 140" },
  {
    key: "F/DOV",
    category: "ball-valve",
    loc: `700 ${leftBottomPortY + 0.75}`,
    angle: 0,
    letter: "P",
    state: "OPEN",
    qualifiedName: "/SystemA/Rocket/FlightComputer/fdov_open",
  },
  {
    key: "MOV",
    category: "ball-valve",
    loc: `${tankLoc.x} 60`,
    angle: 90,
    letter: "P",
    state: "OPEN",
    qualifiedName: "/SystemA/Rocket/FlightComputer/mov_open",
  },
  {
    key: "TANK",
    category: "pressure-tank",
    loc: `${tankLoc.x} ${tankLoc.y}`,
    label: "TANK",
    qualifiedName: "/SystemA/Rocket/FlightComputer/tank_pressure",
    min: 0,
    max: 900,
  },
];

const initialLinkDataArray: Array<LinkData> = [
  { key: 1, from: "N2O", to: "V-22", fromSpot: "Bottom", toSpot: "Left" },
  { key: 2, from: "V-22", to: "PIPE-END-1", fromSpot: "Right", toSpot: "Left" },
  { key: 3, from: "V-21", to: "PIPE-END-2", fromSpot: "Right", toSpot: "Top" },
  { key: 4, from: "V-23", to: "PIPE-END-3", fromSpot: "Right", toSpot: "Top" },
  { key: 5, from: "V-24", to: "PIPE-END-4", fromSpot: "Right", toSpot: "Top" },
  { key: 6, from: "TT-I0", to: "PIPE-MID-0", fromSpot: "Top", toSpot: "Bottom" },
  { key: 7, from: "PT-I1", to: "PIPE-MID-1", fromSpot: "Top", toSpot: "Bottom" },
  { key: 8, from: "PT-I2", to: "PIPE-MID-2", fromSpot: "Top", toSpot: "Bottom" },
  { key: 9, from: "PIPE-END-4", to: "F/DOV", fromSpot: "Right", toSpot: "Left" },
  { key: 10, from: "F/DOV", to: "TANK", fromSpot: "Right", toPort: "LeftBottom", toSpot: "Left" },
  { key: 11, from: "TANK", to: "MOV", fromSpot: "Bottom", toSpot: "Left" },
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

  return typeof raw === "boolean" ? raw : undefined;
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
