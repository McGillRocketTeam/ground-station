import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";

import { BrowserHttpClient } from "@effect/platform-browser";
import { initialMediaState, MediaStateRpcs, type MediaState } from "@mrt/media-state";
import { Context, Effect, Layer, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

class MediaStateClient extends Context.Service<
  MediaStateClient,
  RpcClient.RpcClient<RpcGroup.Rpcs<typeof MediaStateRpcs>, RpcClientError>
>()("@mrt/frontend/MediaStateClient") {
  static readonly layer = Layer.effect(MediaStateClient)(RpcClient.make(MediaStateRpcs)).pipe(
    Layer.provide(
      RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
        Layer.provide([BrowserHttpClient.layerFetch, RpcSerialization.layerNdjson]),
      ),
    ),
  );
}

const mediaStateRuntime = Atom.runtime(MediaStateClient.layer);

export const mediaStateAtom = mediaStateRuntime.atom(
  Stream.unwrap(MediaStateClient.asEffect().pipe(Effect.map((client) => client.WatchMediaState()))),
  { initialValue: initialMediaState },
);

export const setMediaStateAtom = mediaStateRuntime.fn<MediaState>()((state) =>
  MediaStateClient.use((client) => client.SetMediaState({ state })),
);

export const selectMediaState = (result: AsyncResult.AsyncResult<MediaState, unknown>) =>
  AsyncResult.getOrElse(result, () => initialMediaState);
