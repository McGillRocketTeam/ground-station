import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const Scene = Schema.Literals(["TW1", "TW2", "TW3", "TW4", "TW5"]);
export type Scene = typeof Scene.Type;

export const MediaState = Schema.Struct({
  scene: Scene,
  showTankCard: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  showGpsCard: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  redFlagAt: Schema.NullOr(Schema.DateTimeUtcFromString).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
}).annotate({ identifier: "MediaState" });

export interface MediaState extends Schema.Schema.Type<typeof MediaState> {}

export const initialMediaState = MediaState.make({
  scene: "TW1",
  showTankCard: true,
  showGpsCard: true,
  redFlagAt: null,
});

export const MediaStateRpcs = RpcGroup.make(
  Rpc.make("WatchMediaState", {
    success: MediaState,
    stream: true,
  }),
  Rpc.make("SetMediaState", {
    payload: { state: MediaState },
    success: MediaState,
  }),
);
