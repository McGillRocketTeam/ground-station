import { initialMediaState, MediaStateRpcs } from "@mrt/media-state";
import { Effect, Layer, Stream, SubscriptionRef } from "effect";
import { RpcServer } from "effect/unstable/rpc";

const MediaStateHandlers = MediaStateRpcs.toLayer(
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make(initialMediaState);

    return MediaStateRpcs.of({
      WatchMediaState: () =>
        SubscriptionRef.changes(state).pipe(Stream.toQueue({ capacity: "unbounded" })),
      SetMediaState: Effect.fn("MediaStateRpc.set")(function* ({ state: nextState }) {
        yield* SubscriptionRef.set(state, nextState);
        return nextState;
      }),
    });
  }),
);

export const MediaStateRpcLive = RpcServer.layer(MediaStateRpcs, {
  disableFatalDefects: true,
}).pipe(Layer.provide(MediaStateHandlers));
