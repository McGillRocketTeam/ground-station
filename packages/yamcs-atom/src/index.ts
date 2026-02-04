import { Atom, AtomHttpApi, Result } from "@effect-atom/atom-react";
import { Effect, Schema, Chunk, Stream, Schedule, Config } from "effect";
import {
  SubscribeCommandsRequest,
  SubscribeLinksRequest,
  SubscribeParameterRequest,
  SubscribeTimeRequest,
  SubscriptionRequest,
  WebSocketClient,
} from "@mrt/yamcs-effect";
import type {
  StreamingCommandHisotryEntry,
  QualifiedName,
} from "@mrt/yamcs-effect";
import {
  TimeEvent,
  LinkEvent,
  CommandHistoryEvent,
  ParameterEvent,
} from "@mrt/yamcs-effect";
import { mergeCommandEntries } from "./utils.js";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { YamcsApi } from "@mrt/yamcs-effect";
import type { ParseError } from "effect/ParseResult";
import type { UnknownException } from "effect/Cause";
import { NotFound } from "@effect/platform/HttpApiError";
import { RequestError, ResponseError } from "@effect/platform/HttpClientError";
import { ConfigError } from "effect/ConfigError";

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

const yamcsRuntime = Atom.runtime(WebSocketClient.Default);

export const timeSubscriptionAtom: Atom.Atom<
  Result.Result<
    {
      readonly value: Date;
    },
    UnknownException | ParseError | ConfigError
  >
> = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = yield* Config.string("YAMCS_INSTANCE");
      const ws = yield* WebSocketClient;

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
  ),
);

export const linksSubscriptionAtom: Atom.Atom<
  Result.Result<
    (typeof LinkEvent.Type)["data"]["links"],
    UnknownException | ParseError | ConfigError
  >
> = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = yield* Config.string("YAMCS_INSTANCE");
      const ws = yield* WebSocketClient;

      const { call, stream } = yield* ws.subscribe(
        SubscribeLinksRequest.make({ instance }),
      );

      return stream.pipe(
        Stream.mapEffect((m) => Schema.decodeUnknown(LinkEvent)(m)),
        Stream.map((m) => m.data.links),
        Stream.ensuring(ws.unsubscribe(call)),
      );
    }),
  ),
);

export const commandsSubscriptionAtom: Atom.Atom<
  Result.Result<
    Array<(typeof CommandHistoryEvent.Type)["data"]>,
    | UnknownException
    | ParseError
    | NotFound
    | RequestError
    | ResponseError
    | ConfigError
  >
> = yamcsRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = yield* Config.string("YAMCS_INSTANCE");
      const ws = yield* WebSocketClient;

      const subscription = ws.subscribe(
        SubscribeCommandsRequest.make({
          instance,
          processor: "realtime",
        }),
      );

      const queryPriorCommands = get.result(
        YamcsAtomClient.query("command", "listCommands", {
          path: { instance },
        }),
      );

      const [{ call, stream }, { commands: priorCommands }] = yield* Effect.all(
        [subscription, queryPriorCommands],
        {
          concurrency: "unbounded",
        },
      );

      const initial: Map<string, typeof StreamingCommandHisotryEntry.Type> =
        new Map(priorCommands.map((c) => [c.id, c]));

      const dataStream = stream.pipe(
        Stream.mapEffect((m) => Schema.decodeUnknown(CommandHistoryEvent)(m)),
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
            (a, b) => b.generationTime.getTime() - a.generationTime.getTime(),
          ),
        ),
      );
    }),
  ),
);

export const parameterSubscriptionAtom: (
  arg: string,
) => Atom.Atom<
  Result.Result<any, UnknownException | ParseError | ConfigError>
> = Atom.family((qualifiedName: QualifiedName) =>
  yamcsRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const instance = yield* Config.string("YAMCS_INSTANCE");
        const ws = yield* WebSocketClient;

        const { call, stream } = yield* ws.subscribe(
          SubscribeParameterRequest.make({
            instance,
            processor: "realtime",
            id: [{ name: qualifiedName }],
          }),
        );

        const eventStream = stream.pipe(
          Stream.mapEffect((m) => Schema.decodeUnknown(ParameterEvent)(m.data)),
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
