import { Effect, Layer, Schema, Scope, Context } from "effect";
import mqtt from "mqtt";

import { BROKER_URL } from "./Config.ts";

interface PublishParameters {
  message: string | Uint8Array;
  topic: string;
  opts?: mqtt.IClientPublishOptions;
}

interface SubscriptionMessage {
  topic: string;
  payload: Buffer;
  text: string;
}

interface SubscribeParameters {
  topic: string;
  onMessage: (message: SubscriptionMessage) => Effect.Effect<void, any, never>;
}

class MqttError extends Schema.TaggedErrorClass<MqttError>()("MqttError", {
  error: Schema.ErrorWithStack,
}) {}

export class MqttConnection extends Context.Service<
  MqttConnection,
  {
    readonly publish: (
      params: PublishParameters,
    ) => Effect.Effect<void, typeof MqttError.Type, never>;
    readonly subscribe: (
      params: SubscribeParameters,
    ) => Effect.Effect<void, typeof MqttError.Type, Scope.Scope>;
  }
>()("@mrt/simulator/MqttConnection") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const brokerUrl = yield* BROKER_URL;
      const client = mqtt.connect(brokerUrl);
      const services = yield* Effect.context();
      const runFork = Effect.runForkWith(services);

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
            const message =
              typeof props.message === "string"
                ? props.message
                : Buffer.from(props.message);

            client.publish(props.topic, message, props.opts, (error) => {
              return error
                ? resume(Effect.fail(new MqttError({ error: error })))
                : resume(Effect.void);
            });

            return Effect.void;
          });
        });

      const subscribe = (params: SubscribeParameters) => {
        const handler = (topic: string, payload: Buffer) => {
          if (topic !== params.topic) {
            return;
          }

          runFork(
            params
              .onMessage({ topic, payload, text: payload.toString("utf8") })
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.logError(
                    `Failed handling MQTT message for ${topic}`,
                    cause,
                  ),
                ),
              ),
          );
        };

        return Effect.acquireRelease(
          Effect.gen(function* () {
            yield* Effect.callback<void, typeof MqttError.Type>((resume) => {
              client.subscribe(params.topic, (error) => {
                return error
                  ? resume(Effect.fail(new MqttError({ error })))
                  : resume(Effect.void);
              });

              return Effect.void;
            });

            yield* Effect.sync(() => {
              client.on("message", handler);
            });
          }),
          () =>
            Effect.gen(function* () {
              yield* Effect.sync(() => {
                client.off("message", handler);
              });

              yield* Effect.callback<void>((resume) => {
                client.unsubscribe(params.topic, () => {
                  resume(Effect.void);
                });

                return Effect.void;
              });
            }),
        );
      };

      return { publish, subscribe };
    }).pipe(Effect.withLogSpan("MqttConnection")),
  );
}
