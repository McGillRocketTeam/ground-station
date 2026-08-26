import { BrowserHttpClient, BrowserSocket } from "@effect/platform-browser";
import {
  Alarms,
  Commands,
  Parameters,
  YamcsApi,
  YamcsConfig,
  YamcsSubscriptions,
  YamcsWebSocketClient,
} from "@mrt/yamcs-effect";
import { ConfigProvider, Effect, Layer, Logger, Schedule, Tracer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Atom, AtomHttpApi } from "effect/unstable/reactivity";

import { selectedInstanceAtom } from "../frontend";

// type AtomRuntimeContext = AtomRegistry.AtomRegistry | Reactivity.Reactivity;

const transformYamcsHttpClient = (client: HttpClient.HttpClient) =>
  client.pipe(
    HttpClient.transformResponse((effect) =>
      Effect.provideService(effect, Tracer.DisablePropagation, true),
    ),
    HttpClient.mapRequest((req) =>
      HttpClientRequest.setUrl(new URL(req.url.replaceAll("%3A", ":"), yamcsBaseUrl).toString())(
        req,
      ),
    ),
    HttpClient.retryTransient({
      times: 3,
      schedule: Schedule.exponential("500 millis", 2),
    }),
  );

export const yamcsHttpClientLayer: Layer.Layer<HttpClient.HttpClient> = Layer.provideMerge(
  Layer.effect(HttpClient.HttpClient)(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return transformYamcsHttpClient(client);
    }),
  ),
  BrowserHttpClient.layerFetch as Layer.Layer<HttpClient.HttpClient>,
);

export const frontendRuntimeFactory = Atom.context({ memoMap: Atom.defaultMemoMap });
export const yamcsBaseUrl = new URL("/", window.location.origin).toString();
const runtimeEnv = { ...import.meta.env, YAMCS_URL: yamcsBaseUrl };

frontendRuntimeFactory.addGlobalLayer(Logger.layer([Logger.consolePretty()]));
frontendRuntimeFactory.addGlobalLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(runtimeEnv)));

export function logValidationFailure(label: string, error: unknown, raw: unknown) {
  return Effect.logError(`[yamcs] Failed to decode ${label}\n${error}`, raw);
}

export class YamcsAtomHttpClient extends AtomHttpApi.Service<YamcsAtomHttpClient>()(
  "@mrt/frontend/YamcsAtomHttpClient",
  {
    api: YamcsApi,
    httpClient: yamcsHttpClientLayer as Layer.Layer<unknown>,
    runtime: frontendRuntimeFactory,
  },
) {}

type YamcsRealtimeServices =
  | YamcsConfig
  | YamcsWebSocketClient
  | YamcsSubscriptions
  | Commands
  | Parameters
  | Alarms;

function makeYamcsRealtimeLayers(instance: string) {
  const yamcsConfigLayer = Layer.succeed(YamcsConfig, {
    url: new URL(yamcsBaseUrl),
    instance,
    processor: "realtime",
  });
  const socketConfigLayer = Layer.merge(yamcsConfigLayer, BrowserSocket.layerWebSocketConstructor);
  const websocketClientLayer = Layer.provide(
    YamcsWebSocketClient.layer.pipe(
      Layer.tapCause((cause) => Effect.logError("[yamcs] websocket client layer failed", cause)),
    ),
    socketConfigLayer,
  );
  const serviceDependenciesLayer = Layer.mergeAll(
    yamcsConfigLayer,
    websocketClientLayer,
    yamcsHttpClientLayer,
  );
  const subscriptionsLayer = Layer.provide(
    YamcsSubscriptions.layer.pipe(
      Layer.tapCause((cause) => Effect.logError("[yamcs] subscriptions layer failed", cause)),
    ),
    Layer.merge(websocketClientLayer, yamcsConfigLayer),
  );
  const commandsLayer = Layer.provide(
    Commands.layer.pipe(
      Layer.tapCause((cause) => Effect.logError("[yamcs] commands layer failed", cause)),
    ),
    serviceDependenciesLayer,
  );
  const parametersLayer = Layer.provide(
    Parameters.layer.pipe(
      Layer.tapCause((cause) => Effect.logError("[yamcs] parameters layer failed", cause)),
    ),
    serviceDependenciesLayer,
  );
  const alarmsLayer = Layer.provide(
    Alarms.layer.pipe(
      Layer.tapCause((cause) => Effect.logError("[yamcs] alarms layer failed", cause)),
    ),
    serviceDependenciesLayer,
  );

  return Layer.mergeAll(
    yamcsConfigLayer,
    websocketClientLayer,
    subscriptionsLayer,
    commandsLayer,
    parametersLayer,
    alarmsLayer,
  );
}

const inactiveYamcsRealtimeLayers: Layer.Layer<YamcsRealtimeServices> = Layer.unwrap(Effect.never);

export const yamcsSubscriptionRuntime = YamcsAtomHttpClient.runtime.factory((get) => {
  const instance = get(selectedInstanceAtom);

  return instance ? makeYamcsRealtimeLayers(instance) : inactiveYamcsRealtimeLayers;
});
