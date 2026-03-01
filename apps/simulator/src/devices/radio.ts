import { Effect, Schedule } from "effect";

import { getContainer } from "../utils/Container.ts";
import { MqttConnection } from "../utils/MqttConnection.js";
import { makePacketBuilder } from "../utils/PacketBuilder.ts";

export const RadioSimulator = (baseTopic: string) =>
  Effect.gen(function* () {
    const mqtt = yield* MqttConnection;

    const container = yield* getContainer(baseTopic, "TelemetryPacket");

    yield* mqtt
      .publish({ topic: baseTopic + "/status", message: "OK" })
      .pipe(Effect.repeat(Schedule.spaced("5 seconds")), Effect.forkChild);

    const buildPacket = yield* makePacketBuilder(container);

    const publishTelemetry = Effect.gen(function* () {
      const buffer = yield* buildPacket;
      yield* mqtt.publish({
        topic: baseTopic + "/telemetry",
        message: buffer,
      });
    });

    yield* publishTelemetry.pipe(Effect.repeat(Schedule.spaced("2 seconds")));
  }).pipe(Effect.withLogSpan(baseTopic));
