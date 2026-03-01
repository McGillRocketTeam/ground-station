import { Effect, Schedule } from "effect";
import { MqttConnection } from "../utils/MqttConnection.js";
import { BitStream, BitView } from "bit-buffer";

export const RadioSimulator = (baseTopic: string) =>
  Effect.gen(function* () {
    const mqtt = yield* MqttConnection;

    yield* Effect.log("Status: OK");
    yield* mqtt.publish({ topic: baseTopic + "/status", message: "OK" });

    const buffer = Buffer.alloc(40);
    const view = new BitView(buffer);
    const stream = new BitStream(view);

    const seqNumber = 100;
    const rssi = 10;
    const snr = 20;
    stream.writeInt16(seqNumber);
    stream.writeInt8(rssi);
    stream.writeInt8(snr);

    yield* mqtt
      .publish({ topic: baseTopic + "/telemetry", message: buffer })
      .pipe(Effect.repeat(Schedule.spaced("2 seconds")));
  }).pipe(Effect.withLogSpan(baseTopic));
