import { Context, DateTime, Effect, Layer, Schema, Stream } from "effect";
import { Socket } from "effect/unstable/socket";

import type { QualifiedName } from "./schema.js";

import { mergeCommandEntries } from "./utils.js";
import {
  SubscribeTimeRequest,
  SubscribeLinksRequest,
  SubscribeCommandsRequest,
  SubscribeParameterRequest,
  SubscribeEventsRequest,
  type SubscriptionRequest,
} from "./websocket/client-messages.js";
import { YamcsWebSocketClient } from "./websocket/client.js";
import {
  TimeEvent,
  LinkEvent,
  CommandHistoryEvent,
  ParameterEvent,
  EventsEvent,
  type ParameterValue,
} from "./websocket/server-messages.js";
import { YamcsConfig } from "./yamcs-config.js";

export interface YamcsSubscriptionsService {
  readonly time: Stream.Stream<
    (typeof TimeEvent.Type)["data"],
    Schema.SchemaError | Socket.SocketError
  >;
  readonly links: Stream.Stream<
    (typeof LinkEvent.Type)["data"]["links"],
    Schema.SchemaError | Socket.SocketError
  >;
  readonly commands: (
    priorCommands: ReadonlyArray<typeof import("./schema.js").CommandHistoryEntry.Type>,
  ) => Stream.Stream<
    Array<typeof import("./schema.js").StreamingCommandHisotryEntry.Type>,
    Schema.SchemaError | Socket.SocketError
  >;
  readonly parameter: (
    qualifiedName: QualifiedName,
  ) => Stream.Stream<typeof ParameterValue.Type, Schema.SchemaError | Socket.SocketError>;
  readonly events: (
    priorEvents: ReadonlyArray<typeof import("./schema.js").Event.Type>,
  ) => Stream.Stream<
    Array<(typeof EventsEvent.Type)["data"]>,
    Schema.SchemaError | Socket.SocketError
  >;
  readonly websocket: (
    type: typeof SubscriptionRequest.Type,
  ) => Stream.Stream<
    typeof import("./websocket/server-messages.js").Events.Type,
    Socket.SocketError
  >;
}

/**
 * YamcsSubscriptions provides pre-built Effect Streams for subscribing to
 * YAMCS real-time data. Each method returns a Stream that manages its own
 * WebSocket subscription lifecycle (subscribe on start, unsubscribe on end).
 *
 * This service depends on `YamcsWebSocketClient` for WebSocket subscriptions.
 * The `commands` and `events` streams also fetch prior data via HTTP,
 * requiring `HttpClient.HttpClient` in their context.
 */
export class YamcsSubscriptions extends Context.Service<
  YamcsSubscriptions,
  YamcsSubscriptionsService
>()("@mrt/yamcs-effect/YamcsSubscriptions", {
  make: Effect.gen(function* () {
    const ws = yield* YamcsWebSocketClient;
    const yamcsConfig = yield* YamcsConfig;

    /**
     * Subscribe to YAMCS mission time.
     * Emits `{ value: Date }` on every clock tick.
     */
    const time = Stream.unwrap(
      Effect.gen(function* () {
        const { call, stream } = yield* ws.subscribe(
          SubscribeTimeRequest.make({
            instance: yamcsConfig.instance,
            processor: yamcsConfig.processor,
          }),
        );

        return stream.pipe(
          Stream.mapEffect((m) => Schema.decodeUnknownEffect(TimeEvent)(m)),
          Stream.map((m) => m.data),
          Stream.ensuring(Effect.orElseSucceed(ws.unsubscribe(call), () => undefined)),
        );
      }),
    );

    /**
     * Subscribe to YAMCS data link status.
     * Emits the full array of links on every update.
     */
    const links = Stream.unwrap(
      Effect.gen(function* () {
        const { call, stream } = yield* ws.subscribe(
          SubscribeLinksRequest.make({ instance: yamcsConfig.instance }),
        );

        return stream.pipe(
          Stream.mapEffect((m) => Schema.decodeUnknownEffect(LinkEvent)(m)),
          Stream.map((m) => m.data.links),
          Stream.ensuring(Effect.orElseSucceed(ws.unsubscribe(call), () => undefined)),
        );
      }),
    );

    /**
     * Subscribe to command history with initial HTTP fetch.
     * Fetches prior commands from the REST API, then subscribes to
     * real-time command history updates via WebSocket. Merges incoming
     * entries by ID and emits sorted arrays (newest first).
     */
    const commands = (
      priorCommands: ReadonlyArray<typeof import("./schema.js").CommandHistoryEntry.Type>,
    ) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const { call, stream } = yield* ws.subscribe(
            SubscribeCommandsRequest.make({
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
            }),
          );

          const initial = new Map(
            priorCommands.map((c) => [
              c.id,
              c as typeof import("./schema.js").StreamingCommandHisotryEntry.Type,
            ]),
          );

          const dataStream = stream.pipe(
            Stream.mapEffect((m) => Schema.decodeUnknownEffect(CommandHistoryEvent)(m)),
            Stream.map((m) => m.data),
            Stream.ensuring(Effect.orElseSucceed(ws.unsubscribe(call), () => undefined)),
          );

          return dataStream.pipe(
            Stream.scanEffect(initial, (state, commandEntry) =>
              Effect.sync(() => {
                const id = commandEntry.id;
                const current = state.get(id);

                if (current) {
                  state.set(id, mergeCommandEntries(current, commandEntry));
                } else {
                  state.set(id, commandEntry);
                }

                return state;
              }),
            ),
            Stream.map((m) =>
              Array.from(m.values()).sort(
                (a, b) =>
                  DateTime.toEpochMillis(b.generationTime) -
                  DateTime.toEpochMillis(a.generationTime),
              ),
            ),
          );
        }),
      );

    /**
     * Subscribe to a single YAMCS parameter by qualified name.
     * Handles the two-phase protocol: first captures the numeric ID mapping,
     * then streams decoded ParameterValue updates for the requested parameter.
     */
    const parameter = (qualifiedName: QualifiedName) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const { call, stream } = yield* ws.subscribe(
            SubscribeParameterRequest.make({
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
              id: [{ name: qualifiedName }],
            }),
          );

          const eventStream = stream.pipe(
            Stream.mapEffect((m) => Schema.decodeUnknownEffect(ParameterEvent)(m.data)),
          );
          let numericId: string | undefined;

          return eventStream.pipe(
            Stream.flatMap((event) => {
              if ("mapping" in event) {
                const mappedNumericId = Object.entries(event.mapping).find(
                  ([, parameter]) => parameter.name === qualifiedName,
                )?.[0];

                if (mappedNumericId !== undefined) {
                  numericId = mappedNumericId;
                }

                return Stream.empty;
              }

              return Stream.fromIterable(event.values);
            }),
            Stream.filter(
              (value) => numericId !== undefined && String(value.numericId) === numericId,
            ),
            Stream.ensuring(Effect.orElseSucceed(ws.unsubscribe(call), () => undefined)),
          );
        }),
      );

    /**
     * Subscribe to YAMCS events with initial HTTP fetch.
     * Fetches prior events from the REST API, then subscribes to
     * real-time events via WebSocket and accumulates them.
     */
    const events = (priorEvents: ReadonlyArray<typeof import("./schema.js").Event.Type>) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const { call, stream } = yield* ws.subscribe(
            SubscribeEventsRequest.make({ instance: yamcsConfig.instance }),
          );

          // priorEvents should be in chronological order (oldest first)
          const initial = [...priorEvents];

          return stream.pipe(
            Stream.mapEffect((m) => Schema.decodeUnknownEffect(EventsEvent)(m)),
            Stream.scan(initial, (allEvents, event) => [...allEvents, event.data]),
            Stream.ensuring(Effect.orElseSucceed(ws.unsubscribe(call), () => undefined)),
          );
        }),
      );

    /**
     * Generic WebSocket subscription for any request type.
     * Returns the raw message stream without decoding.
     */
    const websocket = (type: typeof SubscriptionRequest.Type) =>
      Stream.unwrap(
        Effect.gen(function* () {
          return (yield* ws.subscribe(type)).stream;
        }),
      );

    return { time, links, commands, parameter, events, websocket };
  }),
}) {
  public static readonly layer = Layer.effect(this, this.make);
}
