import { Effect } from "effect";
import { MqttConnection } from "../utils/MqttConnection.js";
import { BitStream, BitView } from "bit-buffer";

export const RadioSimulator = (baseTopic: string) =>
  Effect.gen(function* () {
    const mqtt = yield* MqttConnection;

    yield* Effect.log("Status: OK");
    yield* mqtt.publish({ topic: baseTopic + "/status", message: "OK" });

    const buffer = Buffer.alloc(16);
    const view = new BitView(buffer);
    const stream = new BitStream(view);
  }).pipe(Effect.withLogSpan(baseTopic));
