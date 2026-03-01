import { Config, Effect, Layer, Schema, ServiceMap } from "effect";
import mqtt from "mqtt";

interface PublishParameters {
  message: string;
  topic: string;
  opts?: mqtt.IClientPublishOptions;
}

class MqttError extends Schema.TaggedErrorClass<MqttError>()("MqttError", {
  error: Schema.ErrorWithStack,
}) {}

export class MqttConnection extends ServiceMap.Service<
  MqttConnection,
  {
    readonly publish: (
      params: PublishParameters,
    ) => Effect.Effect<void, typeof MqttError.Type, never>;
  }
>()("@mrt/simulator/MqttConnection") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const brokerUrl = yield* Config.nonEmptyString("BROKER_URL");
      const client = mqtt.connect(brokerUrl);

      yield* Effect.callback<void>((resume) => {
        client.on("connect", () => {
          resume(Effect.void);
        });

        return Effect.void;
      });

      yield* Effect.log("Connected to MQTT");

      const publish = (props: PublishParameters) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`[${props.topic}]: ${props.message}`);
          yield* Effect.callback<void, typeof MqttError.Type>((resume) => {
            client.publish(props.topic, props.message, props.opts, (error) => {
              return error
                ? resume(Effect.fail(new MqttError({ error: error })))
                : resume(Effect.void);
            });

            return Effect.void;
          });
        });

      return { publish };
    }).pipe(Effect.withLogSpan("MqttConnection")),
  );
}
