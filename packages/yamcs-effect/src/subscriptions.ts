import { Config, Effect, Schema, Stream } from "effect";
import {
  HttpApiClient,
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { WebSocketClient } from "./websocket/client.js";
import {
  SubscribeTimeRequest,
  SubscribeLinksRequest,
  SubscribeCommandsRequest,
  SubscribeParameterRequest,
  SubscribeEventsRequest,
  type SubscriptionRequest,
} from "./websocket/client-messages.js";
import {
  TimeEvent,
  LinkEvent,
  CommandHistoryEvent,
  ParameterEvent,
  EventsEvent,
  type ParameterValue,
} from "./websocket/server-messages.js";
import type { QualifiedName } from "./schema.js";
import { YamcsApi } from "./http/index.js";
import { mergeCommandEntries } from "./utils.js";

/**
 * YamcsSubscriptions provides pre-built Effect Streams for subscribing to
 * YAMCS real-time data. Each method returns a Stream that manages its own
 * WebSocket subscription lifecycle (subscribe on start, unsubscribe on end).
 *
 * This service depends on `WebSocketClient` for WebSocket subscriptions.
 * The `commands` and `events` streams also fetch prior data via HTTP,
 * requiring `HttpClient.HttpClient` in their context.
 */
export class YamcsSubscriptions extends Effect.Service<YamcsSubscriptions>()(
  "@mrt/yamcs-effect/YamcsSubscriptions",
  {
    dependencies: [],
    scoped: Effect.gen(function* () {
      const ws = yield* WebSocketClient;
      const instance = yield* Config.string("YAMCS_INSTANCE");

      /**
       * Subscribe to YAMCS mission time.
       * Emits `{ value: Date }` on every clock tick.
       */
      const time = Stream.unwrap(
        Effect.gen(function* () {
          const { call, stream } = yield* ws.subscribe(
            SubscribeTimeRequest.make({
              instance,
              processor: "realtime",
            }),
          );

          return stream.pipe(
            Stream.mapEffect((m) => Schema.decodeUnknown(TimeEvent)(m)),
            Stream.map((m) => m.data),
            Stream.ensuring(ws.unsubscribe(call)),
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
            SubscribeLinksRequest.make({ instance }),
          );

          return stream.pipe(
            Stream.mapEffect((m) => Schema.decodeUnknown(LinkEvent)(m)),
            Stream.map((m) => m.data.links),
            Stream.ensuring(ws.unsubscribe(call)),
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
        priorCommands: ReadonlyArray<
          typeof import("./schema.js").CommandHistoryEntry.Type
        >,
      ) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const { call, stream } = yield* ws.subscribe(
              SubscribeCommandsRequest.make({
                instance,
                processor: "realtime",
              }),
            );

            const initial = new Map(
              priorCommands.map((c) => [c.id, c as typeof import("./schema.js").StreamingCommandHisotryEntry.Type]),
            );

            const dataStream = stream.pipe(
              Stream.mapEffect((m) =>
                Schema.decodeUnknown(CommandHistoryEvent)(m),
              ),
              Stream.map((m) => m.data),
              Stream.ensuring(ws.unsubscribe(call)),
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
                    b.generationTime.getTime() - a.generationTime.getTime(),
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
                instance,
                processor: "realtime",
                id: [{ name: qualifiedName }],
              }),
            );

            const eventStream = stream.pipe(
              Stream.mapEffect((m) =>
                Schema.decodeUnknown(ParameterEvent)(m.data),
              ),
            );

            // Wait for the mapping message (numeric ID -> parameter name)
            const mappingEvents = yield* eventStream.pipe(
              Stream.filter((e) => "mapping" in e),
              Stream.take(1),
              Stream.runCollect,
            );

            const mapping = Array.from(mappingEvents)[0]!.mapping;

            return eventStream.pipe(
              Stream.filter((e) => "values" in e),
              Stream.map(({ values }) =>
                Object.fromEntries(
                  values.map((v) => {
                    const key = mapping[v.numericId]?.name;
                    return [key, v];
                  }),
                ),
              ),
              Stream.map((a) => a[qualifiedName] as typeof ParameterValue.Type),
              Stream.ensuring(ws.unsubscribe(call)),
            );
          }),
        );

      /**
       * Subscribe to YAMCS events with initial HTTP fetch.
       * Fetches prior events from the REST API, then subscribes to
       * real-time events via WebSocket and accumulates them.
       */
      const events = (
        priorEvents: ReadonlyArray<
          typeof import("./schema.js").Event.Type
        >,
      ) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const { call, stream } = yield* ws.subscribe(
              SubscribeEventsRequest.make({ instance }),
            );

            // priorEvents should be in chronological order (oldest first)
            const initial = [...priorEvents];

            return stream.pipe(
              Stream.mapEffect((m) =>
                Schema.decodeUnknown(EventsEvent)(m),
              ),
              Stream.scan(initial, (allEvents, event) => [
                ...allEvents,
                event.data,
              ]),
              Stream.ensuring(ws.unsubscribe(call)),
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
  },
) {}
