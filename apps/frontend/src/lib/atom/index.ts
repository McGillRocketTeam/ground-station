import { BrowserHttpClient } from "@effect/platform-browser";
import {
  QualifiedName,
  WebSocketClient,
  YamcsApi,
  YamcsSubscriptions,
} from "@mrt/yamcs-effect";
import {
  Config,
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  Schedule,
  Stream,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Atom, AtomHttpApi } from "effect/unstable/reactivity";

const yamcsRuntimeFactory = Atom.context({ memoMap: Atom.defaultMemoMap });

yamcsRuntimeFactory.addGlobalLayer(Logger.layer([Logger.consolePretty()]));
yamcsRuntimeFactory.addGlobalLayer(
  ConfigProvider.layer(ConfigProvider.fromUnknown(import.meta.env)),
);

export const yamcsRuntime = yamcsRuntimeFactory(
  YamcsSubscriptions.layer.pipe(Layer.provide(WebSocketClient.layer)),
);

export class YamcsAtomHttpClient extends AtomHttpApi.Service<YamcsAtomHttpClient>()(
  "@mrt/frontend/YamcsAtomHttpClient",
  {
    api: YamcsApi,
    httpClient: BrowserHttpClient.layerFetch as Layer.Layer<unknown>,
    runtime: yamcsRuntimeFactory,
    transformClient: (client) =>
      client.pipe(
        HttpClient.mapRequest((req) =>
          HttpClientRequest.setUrl(req.url.replaceAll("%3A", ":"))(req),
        ),
        HttpClient.retryTransient({
          times: 3,
          schedule: Schedule.exponential("500 millis", 2),
        }),
      ),
  },
) {}

export const timeSubscriptionAtom = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const yamcs = yield* YamcsSubscriptions;

      return yamcs.time;
    }),
  ),
);

export const linksSubscriptionAtom = yamcsRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const yamcs = yield* YamcsSubscriptions;

      return yamcs.links;
    }),
  ),
);

export const commandsSubscriptionAtom = yamcsRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const subs = yield* YamcsSubscriptions;
      const instance = yield* Config.string("YAMCS_INSTANCE");

      const { commands: priorCommands } = yield* get.result(
        YamcsAtomHttpClient.query("command", "listCommands", {
          params: { instance },
        }),
      );

      return subs.commands(priorCommands);
    }),
  ),
);
//
export const parameterSubscriptionAtom = Atom.family(
  (qualifiedName: QualifiedName) =>
    yamcsRuntime.atom(
      Stream.unwrap(
        Effect.gen(function* () {
          const subs = yield* YamcsSubscriptions;

          return subs.parameter(qualifiedName);
        }),
      ),
    ),
);

export const eventsSubscriptionAtom = yamcsRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const subs = yield* YamcsSubscriptions;
      const instance = yield* Config.string("YAMCS_INSTANCE");

      const { events } = yield* get.result(
        YamcsAtomHttpClient.query("event", "listEvents", {
          params: { instance },
          query: {},
        }),
      );

      const priorEvents = events.slice().reverse();

      return subs.events(priorEvents);
    }),
  ),
);
