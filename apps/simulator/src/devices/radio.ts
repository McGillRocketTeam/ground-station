import { Effect } from "effect";
import { MqttConnection } from "../utils/MqttConnection.js";

export const RadioSimulator = (baseTopic: string) =>
  Effect.gen(function* () {
    const mqtt = yield* MqttConnection;

    mqtt.publish(baseTopic + "/status");
    mqtt.publish(baseTopic + "/detail");
  });
