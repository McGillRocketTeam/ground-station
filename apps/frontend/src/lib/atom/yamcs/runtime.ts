import { BrowserHttpClient, BrowserSocket } from "@effect/platform-browser";
import {
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

const yamcsHttpClientLayer: Layer.Layer<HttpClient.HttpClient> = Layer.provideMerge(
  Layer.effect(HttpClient.HttpClient)(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return transformYamcsHttpClient(client);
    }),
  ),
  BrowserHttpClient.layerFetch as Layer.Layer<HttpClient.HttpClient>,
);

export const frontendRuntimeFactory = Atom.context({ memoMap: Atom.defaultMemoMap });
function resolveRuntimeUrl(url: string): string {
  const parsedUrl = new URL(url);

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsedUrl.hostname) &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    parsedUrl.hostname = window.location.hostname;
  }

  return parsedUrl.toString();
}

export const yamcsBaseUrl = resolveRuntimeUrl(import.meta.env.YAMCS_URL);
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

export const yamcsSubscriptionRuntime = YamcsAtomHttpClient.runtime.factory((get) => {
  const yamcsConfigLayer = Layer.succeed(YamcsConfig, {
    url: new URL(yamcsBaseUrl),
    instance: get(selectedInstanceAtom),
    processor: "realtime",
  });
  const socketRequirementsLayer = Layer.merge(
    yamcsConfigLayer,
    BrowserSocket.layerWebSocketConstructor,
  );

  const websocketLayer = Layer.provideMerge(YamcsWebSocketClient.layer, socketRequirementsLayer);
  const subscriptionsLayer = Layer.provideMerge(YamcsSubscriptions.layer, websocketLayer);
  const commandsLayer = Layer.provideMerge(
    Commands.layer,
    Layer.merge(socketRequirementsLayer, yamcsHttpClientLayer),
  );
  const parametersLayer = Layer.provideMerge(
    Parameters.layer,
    Layer.merge(socketRequirementsLayer, yamcsHttpClientLayer),
  );

  return Layer.mergeAll(subscriptionsLayer, commandsLayer, parametersLayer);
});
