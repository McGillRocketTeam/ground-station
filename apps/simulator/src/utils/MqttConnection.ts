import { Config, Effect, Latch, Layer, ServiceMap } from "effect";
import mqtt from "mqtt";

export class MqttConnection extends ServiceMap.Service<MqttConnection, {}>()(
  "@mrt/simulator/MqttConnection",
) {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const brokerUrl = yield* Config.nonEmptyString("BROKER_URL");
      const client = mqtt.connect(brokerUrl);

      yield* Latch.make(false);

      return {};
    }),
  );
}
