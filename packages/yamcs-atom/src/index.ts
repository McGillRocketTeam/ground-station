import { Atom, AtomHttpApi, Result } from "@effect-atom/atom-react";
import { Effect, Layer, Stream, Schedule, Config } from "effect";
import {
  SubscriptionRequest,
  WebSocketClient,
  YamcsSubscriptions,
} from "@mrt/yamcs-effect";
import type {
  QualifiedName,
  ParameterValue,
} from "@mrt/yamcs-effect";
import {
  TimeEvent,
  LinkEvent,
  CommandHistoryEvent,
  EventsEvent,
} from "@mrt/yamcs-effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { YamcsApi } from "@mrt/yamcs-effect";
import type { ParseError } from "effect/ParseResult";
import type { UnknownException } from "effect/Cause";
import { NotFound } from "@effect/platform/HttpApiError";
import {
  HttpClientError,
  RequestError,
  ResponseError,
} from "@effect/platform/HttpClientError";
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

export const yamcsRuntime = Atom.runtime(
  YamcsSubscriptions.Default.pipe(Layer.provide(WebSocketClient.Default)),
);

export const timeSubscriptionAtom: Atom.Atom<
  Result.Result<
    {
      readonly value: Date;
    },
    UnknownException | ParseError | ConfigError
  >
> = yamcsRuntime.atom(
  Effect.map(YamcsSubscriptions, (subs) => subs.time).pipe(Stream.unwrap),
);

export const linksSubscriptionAtom: Atom.Atom<
  Result.Result<
    (typeof LinkEvent.Type)["data"]["links"],
    UnknownException | ParseError | ConfigError
  >
> = yamcsRuntime.atom(
  Effect.map(YamcsSubscriptions, (subs) => subs.links).pipe(Stream.unwrap),
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
      const subs = yield* YamcsSubscriptions;
      const instance = yield* Config.string("YAMCS_INSTANCE");

      const { commands: priorCommands } = yield* get.result(
        YamcsAtomClient.query("command", "listCommands", {
          path: { instance },
        }),
      );

      return subs.commands(priorCommands);
    }),
  ),
);

export const parameterSubscriptionAtom: (
  arg: string,
) => Atom.Atom<
  Result.Result<
    typeof ParameterValue.Type,
    UnknownException | ParseError | ConfigError
  >
> = Atom.family((qualifiedName: QualifiedName) =>
  yamcsRuntime.atom(
    Effect.map(YamcsSubscriptions, (subs) => subs.parameter(qualifiedName)).pipe(
      Stream.unwrap,
    ),
  ),
);

export const eventsSubscriptionAtom: Atom.Atom<
  Result.Result<
    Array<(typeof EventsEvent.Type)["data"]>,
    NotFound | HttpClientError | UnknownException | ConfigError | ParseError
  >
> = yamcsRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const subs = yield* YamcsSubscriptions;
      const instance = yield* Config.string("YAMCS_INSTANCE");

      const { events } = yield* get.result(
        YamcsAtomClient.query("event", "listEvents", { path: { instance } }),
      );

      const priorEvents = events.slice().reverse();

      return subs.events(priorEvents);
    }),
  ),
);

export const websocketAtom = Atom.family(
  (type: typeof SubscriptionRequest.Type) =>
    yamcsRuntime.atom(
      Effect.map(YamcsSubscriptions, (subs) => subs.websocket(type)).pipe(
        Stream.unwrap,
      ),
    ),
);
