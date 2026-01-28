import { Atom, AtomHttpApi } from "@effect-atom/atom-react";
import { Effect, Schema, Chunk, Stream, Schedule } from "effect";
import {
  SubscribeCommandsRequest,
  SubscribeLinksRequest,
  SubscribeParameterRequest,
  SubscribeTimeRequest,
  SubscriptionRequest,
  WebSocketClient,
} from "@mrt/yamcs-effect/websocket";
import type {
  StreamingCommandHisotryEntry,
  QualifiedName,
} from "@mrt/yamcs-effect/schema";
import {
  TimeEvent,
  LinkEvent,
  CommandHistoryEvent,
  ParameterEvent,
} from "@mrt/yamcs-effect/websocket";
import { mergeCommandEntries } from "./utils";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { YamcsApi } from "@mrt/yamcs-effect/http";

export class YamcsAtomClient extends AtomHttpApi.Tag<YamcsAtomClient>()(
  "@mrt/yamcs-atom/YamcsAtomClient",
  {
    api: YamcsApi,
    httpClient: FetchHttpClient.layer,
    baseUrl: "http://localhost:8090",
    transformClient: (client) =>
      client.pipe(
        HttpClient.withTracerDisabledWhen(() => true),
        HttpClient.tapRequest((req) =>
          Effect.logDebug(`[YAMCS HTTP]: ${req.url}`),
        ),
        HttpClient.mapRequest((req) =>
          HttpClientRequest.setUrl(req.url.replaceAll("%3A", ":"))(req),
        ),
        HttpClient.retryTransient({
          times: 3,
          schedule: Schedule.exponential("100 millis", 2),
        }),
      ),
  },
) {}

const INSTANCE = "ground_station";

const yamcsRuntime = Atom.runtime(WebSocketClient.Default);

export const timeSubscriptionAtom = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const ws = yield* WebSocketClient;

      const { call, stream } = yield* ws.subscribe(
        SubscribeTimeRequest.make({
          instance: INSTANCE,
          processor: "realtime",
        }),
      );

      return stream.pipe(
        Stream.mapEffect((m) => Schema.decodeUnknown(TimeEvent)(m)),
        Stream.map((m) => m.data),
        Stream.ensuring(ws.unsubscribe(call)),
      );
    }),
  ),
);

export const linksSubscriptionAtom = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const ws = yield* WebSocketClient;

      const { call, stream } = yield* ws.subscribe(
        SubscribeLinksRequest.make({ instance: INSTANCE }),
      );

      return stream.pipe(
        Stream.mapEffect((m) => Schema.decodeUnknown(LinkEvent)(m)),
        Stream.map((m) => m.data.links),
        Stream.ensuring(ws.unsubscribe(call)),
      );
    }),
  ),
);

export const commandsSubscriptionAtom = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const ws = yield* WebSocketClient;

      const { call, stream } = yield* ws.subscribe(
        SubscribeCommandsRequest.make({
          instance: INSTANCE,
          processor: "realtime",
        }),
      );

      const dataStream = stream.pipe(
        Stream.mapEffect((m) => Schema.decodeUnknown(CommandHistoryEvent)(m)),
        Stream.map((m) => m.data),
        Stream.ensuring(ws.unsubscribe(call)),
      );

      return dataStream.pipe(
        Stream.scanEffect(
          new Map<string, typeof StreamingCommandHisotryEntry.Type>(),
          (state, commandEntry) =>
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
        Stream.map((m) => Array.from(m.values())),
      );
    }),
  ),
);

export const parameterSubscriptionAtom = Atom.family(
  (qualifiedName: QualifiedName) =>
    yamcsRuntime.atom(
      Stream.unwrap(
        Effect.gen(function* () {
          const ws = yield* WebSocketClient;

          const { call, stream } = yield* ws.subscribe(
            SubscribeParameterRequest.make({
              instance: INSTANCE,
              processor: "realtime",
              id: [{ name: qualifiedName }],
            }),
          );

          const eventStream = stream.pipe(
            Stream.mapEffect((m) =>
              Schema.decodeUnknown(ParameterEvent)(m.data),
            ),
          );

          // Store the mapping
          const mapping = Chunk.toReadonlyArray(
            yield* eventStream.pipe(
              Stream.filter((e) => "mapping" in e),
              Stream.take(1),
              Stream.runCollect,
            ),
          )[0]!.mapping;

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
            Stream.map((a) => a[qualifiedName]),
            Stream.ensuring(ws.unsubscribe(call)),
          );
        }),
      ),
    ),
);

export const websocketAtom = Atom.family(
  (type: typeof SubscriptionRequest.Type) =>
    yamcsRuntime.atom(
      Stream.unwrap(
        Effect.gen(function* () {
          const ws = yield* WebSocketClient;
          return (yield* ws.subscribe(type)).stream;
        }),
      ),
    ),
);
