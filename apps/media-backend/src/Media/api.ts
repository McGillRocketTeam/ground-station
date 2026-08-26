import { Effect, Layer } from "effect";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { OverlayState } from "./schema/index.ts";
import { OverlayStateStore } from "./service.ts";

export const MediaClientApi = HttpApi.make("MediaClientApi").add(
  HttpApiGroup.make("Overlay")
    .add(
      HttpApiEndpoint.get("getState", "/state", {
        success: OverlayState,
      }),
    )
    .prefix("/overlay"),
);

const OverlayGroupLive = HttpApiBuilder.group(
  MediaClientApi,
  "Overlay",
  Effect.fnUntraced(function* (handlers) {
    const overlayStateStore = yield* OverlayStateStore;

    return handlers.handle("getState", () => overlayStateStore.get);
  }),
).pipe(Layer.provide(OverlayStateStore.layer));

export const MediaClientRoutes = HttpApiBuilder.layer(MediaClientApi).pipe(
  Layer.provide(OverlayGroupLive),
);
