import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const Scene = Schema.Literals(["TW1", "TW2", "TW3", "TW4", "TW5"]);
export type Scene = typeof Scene.Type;

export const PrimarySystem = Schema.Literals(["SystemA", "SystemB"]);
export type PrimarySystem = typeof PrimarySystem.Type;

export const MediaState = Schema.Struct({
  scene: Scene,
  primarySystem: PrimarySystem.pipe(Schema.withDecodingDefaultKey(Effect.succeed("SystemA"))),
  showTankCard: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  showGpsCard: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  showAltitudeCard: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  redFlagAt: Schema.NullOr(Schema.DateTimeUtcFromString).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  missionUpdate: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
}).annotate({ identifier: "MediaState" });

export interface MediaState extends Schema.Schema.Type<typeof MediaState> {}

export const initialMediaState = MediaState.make({
  scene: "TW1",
  primarySystem: "SystemA",
  showTankCard: true,
  showGpsCard: true,
  showAltitudeCard: true,
  redFlagAt: null,
  missionUpdate: null,
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
