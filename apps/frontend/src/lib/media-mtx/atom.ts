import { BrowserHttpClient } from "@effect/platform-browser";
import { Effect, Layer, Tracer } from "effect";
import { HttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

import { MediaMtxApi } from "./api";

function resolveMediaMtxBaseUrl() {
  const configuredUrl = import.meta.env.MRT_MEDIAMTX_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:9997`;
  }

  return "http://localhost:9997";
}

export const mediaMtxBaseUrl = resolveMediaMtxBaseUrl();

function resolveMediaMtxWebRtcBaseUrl() {
  const configuredUrl = import.meta.env.MRT_MEDIAMTX_WEBRTC_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  const url = new URL(mediaMtxBaseUrl);
  url.port = "8889";

  return url.toString();
}

export const mediaMtxWebRtcBaseUrl = resolveMediaMtxWebRtcBaseUrl();

const mediaMtxHttpClientLayer: Layer.Layer<HttpClient.HttpClient> = Layer.provideMerge(
  Layer.effect(HttpClient.HttpClient)(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      return client.pipe(
        HttpClient.transformResponse((effect) =>
          Effect.provideService(effect, Tracer.DisablePropagation, true),
        ),
      );
    }),
  ),
  BrowserHttpClient.layerFetch,
);

export class MediaMtxAtomHttpClient extends AtomHttpApi.Service<MediaMtxAtomHttpClient>()(
  "@mrt/frontend/MediaMtxAtomHttpClient",
  {
    api: MediaMtxApi,
    baseUrl: mediaMtxBaseUrl,
    httpClient: mediaMtxHttpClientLayer,
  },
) {}

export const mediaPathsAtom = MediaMtxAtomHttpClient.query("Paths", "list", { query: {} });
