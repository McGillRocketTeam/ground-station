import { Effect, PubSub, Ref, Schema, Scope, Stream } from "effect";

import { MqttConnection } from "./utils/MqttConnection.ts";

export type AstraPayload = string | Uint8Array;

export const AstraStatus = Schema.Literals([
  "DISABLED",
  "OK",
  "UNAVAIL",
  "FAILED",
]);

export type AstraStatus = typeof AstraStatus.Type;

export const AstraDetail = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(240),
);

export type AstraDetail = typeof AstraDetail.Type;

export const AstraCommandText = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(120),
);

export type AstraCommandText = typeof AstraCommandText.Type;

export const AstraTelemetry = Schema.Uint8Array;

export type AstraTelemetry = typeof AstraTelemetry.Type;

export const AstraAckStatus = Schema.Literals([
  "RX_OK",
  "TX_OK",
  "RX_FAIL",
  "TX_FAIL",
  "RX_NOK",
  "TX_NOK",
]);

export type AstraAckStatus = typeof AstraAckStatus.Type;

export const AstraAck = Schema.Struct({
  cmd_id: Schema.Int,
  status: AstraAckStatus,
});

export type AstraAck = typeof AstraAck.Type;

const encodeAck = Schema.encodeUnknownSync(Schema.fromJsonString(AstraAck));

export const encodeAstraAck = (ack: AstraAck) => encodeAck(ack);

export const AstraEndpointSchema = Schema.Struct({
  base: Schema.String,
  status: Schema.String,
  detail: Schema.String,
  telemetry: Schema.String,
  commands: Schema.String,
  acks: Schema.String,
});

export type AstraEndpoint = typeof AstraEndpointSchema.Type;

export const makeAstraEndpoint = (baseTopic: string): AstraEndpoint => ({
  base: baseTopic,
  status: `${baseTopic}/status`,
  detail: `${baseTopic}/detail`,
  telemetry: `${baseTopic}/telemetry`,
  commands: `${baseTopic}/commands`,
  acks: `${baseTopic}/acks`,
});

export interface AstraOutgoingMessage {
  readonly topic: string;
  readonly message: AstraPayload;
}

export interface AstraCommandMessage {
  readonly endpoint: AstraEndpoint;
  readonly topic: string;
  readonly payload: Buffer;
  readonly text: AstraCommandText;
}

export interface AstraPublisher {
  readonly publish: (
    topic: string,
    message: AstraPayload,
  ) => Effect.Effect<boolean>;
  readonly publishStatus: (
    endpoint: AstraEndpoint,
    status: AstraStatus,
  ) => Effect.Effect<boolean>;
  readonly publishDetail: (
    endpoint: AstraEndpoint,
    detail: AstraDetail,
  ) => Effect.Effect<boolean>;
  readonly publishTelemetry: (
    endpoint: AstraEndpoint,
    telemetry: AstraTelemetry,
  ) => Effect.Effect<boolean>;
  readonly publishAck: (
    endpoint: AstraEndpoint,
    ack: AstraAck,
  ) => Effect.Effect<boolean>;
}

export interface AstraCommandRoute<E = never> {
  readonly endpoint: AstraEndpoint;
  readonly handleCommand: (
    command: AstraCommandMessage,
  ) => Effect.Effect<void, E, never>;
}

export interface AstraActorContext<State> extends AstraPublisher {
  readonly actorName: string;
  readonly currentState: Effect.Effect<State>;
  readonly setState: (state: State) => Effect.Effect<void>;
  readonly updateState: (
    update: (state: State) => State,
  ) => Effect.Effect<State>;
}

export interface AstraActorBehavior<E = never> {
  readonly boot?: Effect.Effect<void, E, Scope.Scope>;
  readonly commandRoutes?: ReadonlyArray<AstraCommandRoute<E>>;
}

export interface AstraActor<State, E = never> {
  readonly actorName: string;
  readonly currentState: Effect.Effect<State>;
  readonly outgoing: PubSub.PubSub<AstraOutgoingMessage>;
  readonly boot: Effect.Effect<void, E, Scope.Scope>;
  readonly commandRoutes: ReadonlyArray<AstraCommandRoute<E>>;
}

export interface AstraActorDefinition<
  State,
  MakeE = never,
  MakeR = never,
  RunE = never,
> {
  readonly name: string;
  readonly initialState: State;
  readonly make: (
    context: AstraActorContext<State>,
  ) => Effect.Effect<AstraActorBehavior<RunE>, MakeE, MakeR>;
}

const decodeCommandText = Schema.decodeUnknownOption(AstraCommandText);

const makePublisher = (
  outgoing: PubSub.PubSub<AstraOutgoingMessage>,
): AstraPublisher => ({
  publish: (topic, message) => PubSub.publish(outgoing, { topic, message }),
  publishStatus: (endpoint, status) =>
    PubSub.publish(outgoing, { topic: endpoint.status, message: status }),
  publishDetail: (endpoint, detail) =>
    PubSub.publish(outgoing, { topic: endpoint.detail, message: detail }),
  publishTelemetry: (endpoint, telemetry) =>
    PubSub.publish(outgoing, { topic: endpoint.telemetry, message: telemetry }),
  publishAck: (endpoint, ack) =>
    PubSub.publish(outgoing, {
      topic: endpoint.acks,
      message: encodeAstraAck(ack),
    }),
});

export const makeAstraActor = <
  State,
  MakeE = never,
  MakeR = never,
  RunE = never,
>(
  definition: AstraActorDefinition<State, MakeE, MakeR, RunE>,
): Effect.Effect<AstraActor<State, RunE>, MakeE, MakeR> =>
  Effect.gen(function* () {
    const state = yield* Ref.make(definition.initialState);
    const outgoing = yield* PubSub.unbounded<AstraOutgoingMessage>();
    const publisher = makePublisher(outgoing);

    const context: AstraActorContext<State> = {
      actorName: definition.name,
      currentState: Ref.get(state),
      setState: (nextState) => Ref.set(state, nextState),
      updateState: (update) =>
        Ref.modify(state, (currentState) => {
          const nextState = update(currentState);
          return [nextState, nextState] as const;
        }),
      ...publisher,
    };

    const behavior = yield* definition.make(context);

    return {
      actorName: definition.name,
      currentState: context.currentState,
      outgoing,
      boot: behavior.boot ?? Effect.void,
      commandRoutes: behavior.commandRoutes ?? [],
    };
  });

export const runAstraActor = <State, E = never>(actor: AstraActor<State, E>) =>
  Effect.gen(function* () {
    const mqtt = yield* MqttConnection;

    yield* Stream.fromPubSub(actor.outgoing).pipe(
      Stream.runForEach((message) => mqtt.publish(message)),
      Effect.forkScoped,
    );

    yield* Effect.forEach(
      actor.commandRoutes,
      (route) =>
        mqtt.subscribe({
          topic: route.endpoint.commands,
          onMessage: (message) => {
            const commandText = decodeCommandText(message.text.trim());

            if (commandText._tag === "None") {
              return Effect.logWarning(
                `[${actor.actorName}] ignored invalid command on ${route.endpoint.commands}`,
              );
            }

            return route.handleCommand({
              endpoint: route.endpoint,
              topic: message.topic,
              payload: message.payload,
              text: commandText.value,
            });
          },
        }),
      { concurrency: "unbounded" },
    );

    yield* actor.boot.pipe(Effect.forkScoped);
    return yield* Effect.never;
  }).pipe(Effect.withLogSpan(actor.actorName));
