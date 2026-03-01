import { Effect } from "effect";
import { MqttConnection } from "../utils/MqttConnection.ts";

export const FlightComputerSimulator = (baseTopic: string) =>
  Effect.gen(function* () {
    const mqtt = yield* MqttConnection;

    yield* Effect.log("Status: OK");
    yield* mqtt.publish({ topic: baseTopic + "/status", message: "OK" });
  }).pipe(Effect.withLogSpan(baseTopic));
