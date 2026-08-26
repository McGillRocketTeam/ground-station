import { initialMediaState, MediaState, MediaStateRpcs } from "@mrt/media-state";
import { Context, Effect, Layer, Queue, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

const storageKey = "mrt.media.state";
const localStateChangedEvent = "mrt-media-state-changed";
const MediaStateJson = Schema.fromJsonString(MediaState);

export class ControlStateError extends Schema.TaggedErrorClass<ControlStateError>()(
  "ControlStateError",
  {
    source: Schema.Literals(["local", "remote"]),
    operation: Schema.String,
    cause: Schema.Defect,
  },
) {}

interface ControlStateService {
  readonly changes: Stream.Stream<MediaState, ControlStateError>;
  readonly set: (state: MediaState) => Effect.Effect<MediaState, ControlStateError>;
}

export class ControlState extends Context.Service<ControlState, ControlStateService>()(
  "@mrt/media-frontend/ControlState",
) {}

const localError = (operation: string, cause: unknown) =>
  ControlStateError.make({ source: "local", operation, cause });

const remoteError = (operation: string, cause: unknown) =>
  ControlStateError.make({ source: "remote", operation, cause });

const readStoredState = (raw: string | null) =>
  raw === null
    ? Effect.succeed(initialMediaState)
    : Schema.decodeUnknownEffect(MediaStateJson)(raw).pipe(
        Effect.mapError((cause) => localError("decode", cause)),
      );

export const layerLocal = Layer.effect(
  ControlState,
  Effect.sync(() => {
    const changes = Stream.callback<string | null, ControlStateError>((queue) =>
      Effect.acquireRelease(
        Effect.try({
          try: () => {
            Queue.offerUnsafe(queue, window.localStorage.getItem(storageKey));

            const handleStorage = (event: StorageEvent) => {
              if (event.key === storageKey) Queue.offerUnsafe(queue, event.newValue);
            };
            const handleLocalChange = (event: Event) => {
              if (event instanceof CustomEvent && typeof event.detail === "string") {
                Queue.offerUnsafe(queue, event.detail);
              }
            };

            window.addEventListener("storage", handleStorage);
            window.addEventListener(localStateChangedEvent, handleLocalChange);

            return { handleLocalChange, handleStorage };
          },
          catch: (cause) => localError("subscribe", cause),
        }),
        ({ handleLocalChange, handleStorage }) =>
          Effect.sync(() => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(localStateChangedEvent, handleLocalChange);
          }),
      ),
    ).pipe(Stream.mapEffect(readStoredState));

    const set = Effect.fn("ControlState.local.set")(function* (state: MediaState) {
      const encoded = yield* Schema.encodeEffect(MediaStateJson)(state).pipe(
        Effect.mapError((cause) => localError("encode", cause)),
      );

      yield* Effect.try({
        try: () => {
          window.localStorage.setItem(storageKey, encoded);
          window.dispatchEvent(new CustomEvent(localStateChangedEvent, { detail: encoded }));
        },
        catch: (cause) => localError("write", cause),
      });

      return state;
    });

    return ControlState.of({ changes, set });
  }),
);

const RemoteProtocol = RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
  Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
);

export const layerRemote = Layer.effect(
  ControlState,
  Effect.gen(function* () {
    const client = yield* RpcClient.make(MediaStateRpcs);

    const changes = client
      .WatchMediaState()
      .pipe(Stream.mapError((cause) => remoteError("watch", cause)));

    const set = Effect.fn("ControlState.remote.set")(function* (state: MediaState) {
      return yield* client
        .SetMediaState({ state })
        .pipe(Effect.mapError((cause) => remoteError("set", cause)));
    });

    return ControlState.of({ changes, set });
  }),
).pipe(Layer.provide(RemoteProtocol));
