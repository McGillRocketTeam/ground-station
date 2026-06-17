import { Context, Data, Effect, Layer, RcMap, Schema, Scope, Semaphore, Stream } from "effect";
import { HttpApiClient } from "effect/unstable/httpapi";

import { YamcsApi } from "../http/index.ts";
import { ParameterInfo, type QualifiedName, Value } from "../schema.ts";
import { SubscribeParameterRequest } from "../websocket/client-messages.ts";
import { WebSocketClient } from "../websocket/client.ts";
import {
  ParameterEvent,
  type ParameterValue,
  type SubscriptionId,
} from "../websocket/server-messages.ts";
import { YamcsConfig } from "../yamcs-config.ts";

const parameterValueContentEquivalence = Schema.toEquivalence(
  Schema.Struct({
    rawValue: Schema.optional(Value),
    engValue: Value,
  }),
);

export class ParameterNotFound extends Data.TaggedError("ParameterNotFound")<{
  readonly qualifiedName: QualifiedName;
}> {}

export interface ParameterSubscription {
  readonly info: typeof ParameterInfo.Type;
  readonly updates: Stream.Stream<
    {
      readonly info: typeof ParameterInfo.Type;
      readonly value: ParameterValue;
    },
    Schema.SchemaError
  >;
}

interface ActiveParameterCall {
  readonly call: SubscriptionId;
  readonly eventStream: Stream.Stream<typeof ParameterEvent.Type, Schema.SchemaError>;
  readonly numericIdsByQualifiedName: Map<QualifiedName, string>;
}

export class Parameters extends Context.Service<
  Parameters,
  {
    readonly all: ReadonlyArray<typeof ParameterInfo.Type>;
    readonly get: (
      parameter: QualifiedName,
    ) => Effect.Effect<typeof ParameterInfo.Type, ParameterNotFound>;
    readonly subscribe: (
      parameter: QualifiedName,
    ) => Effect.Effect<ParameterSubscription, ParameterNotFound | Schema.SchemaError, Scope.Scope>;
  }
>()("@mrt/yamcs-effect/Parameters") {
  static readonly layer = Layer.effect(
    Parameters,
    Effect.gen(function* () {
      const websocketClient = yield* WebSocketClient;
      const yamcsConfig = yield* YamcsConfig;

      const httpClient = yield* HttpApiClient.make(YamcsApi);

      const { parameters: all } = yield* httpClient.mdb.listParameters({
        params: { instance: yamcsConfig.instance },
        query: { limit: "400" },
      });

      const parameterInfoByQualifiedName = new Map(
        all.map((parameter) => [parameter.qualifiedName, parameter] as const),
      );
      const parameterCallSemaphore = yield* Semaphore.make(1);
      let activeParameterCall: ActiveParameterCall | undefined;

      const get = (qualifiedName: QualifiedName) =>
        Effect.gen(function* () {
          const parameterInfo = parameterInfoByQualifiedName.get(qualifiedName);

          if (parameterInfo === undefined) {
            return yield* new ParameterNotFound({ qualifiedName });
          }

          return parameterInfo;
        });

      const getNumericIdFromMapping = (
        qualifiedName: QualifiedName,
        mapping: Record<string, { readonly name: string }>,
      ) => {
        for (const [numericId, parameter] of Object.entries(mapping)) {
          if (parameter.name === qualifiedName) {
            return numericId;
          }
        }

        return undefined;
      };

      const awaitNumericId = (
        eventStream: Stream.Stream<typeof ParameterEvent.Type, Schema.SchemaError>,
        qualifiedName: QualifiedName,
      ) =>
        Effect.gen(function* () {
          const mappingEvents = yield* eventStream.pipe(
            Stream.filter((event) => "mapping" in event),
            Stream.map((event) => getNumericIdFromMapping(qualifiedName, event.mapping)),
            Stream.filter((numericId) => numericId !== undefined),
            Stream.take(1),
            Stream.runCollect,
          );

          const numericId = Array.from(mappingEvents)[0];

          if (numericId === undefined) {
            return yield* new ParameterNotFound({ qualifiedName });
          }

          return numericId;
        });

      const openParameterCall = (qualifiedName: QualifiedName) =>
        Effect.gen(function* () {
          const { call, stream } = yield* websocketClient.subscribe(
            SubscribeParameterRequest.make({
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
              id: [{ name: qualifiedName }],
              action: "REPLACE",
            }),
          );

          const eventStream = stream.pipe(
            Stream.mapEffect((message) => Schema.decodeUnknownEffect(ParameterEvent)(message.data)),
          );

          const numericId = yield* awaitNumericId(eventStream, qualifiedName);

          return {
            call,
            eventStream,
            numericIdsByQualifiedName: new Map([[qualifiedName, numericId]]),
          } satisfies ActiveParameterCall;
        });

      const ensureSubscribed = (qualifiedName: QualifiedName) =>
        parameterCallSemaphore.withPermits(1)(
          Effect.gen(function* () {
            const current = activeParameterCall;

            if (current === undefined) {
              const created = yield* openParameterCall(qualifiedName);
              activeParameterCall = created;

              return {
                eventStream: created.eventStream,
                numericId: created.numericIdsByQualifiedName.get(qualifiedName)!,
              };
            }

            const existingNumericId = current.numericIdsByQualifiedName.get(qualifiedName);

            if (existingNumericId !== undefined) {
              return {
                eventStream: current.eventStream,
                numericId: existingNumericId,
              };
            }

            yield* websocketClient.sendWithoutReply({
              type: "parameters",
              call: current.call,
              options: {
                instance: yamcsConfig.instance,
                processor: yamcsConfig.processor,
                id: [{ name: qualifiedName }],
                action: "ADD",
              },
            });

            const numericId = yield* awaitNumericId(current.eventStream, qualifiedName);
            current.numericIdsByQualifiedName.set(qualifiedName, numericId);

            return {
              eventStream: current.eventStream,
              numericId,
            };
          }),
        );

      const unsubscribeParameter = (qualifiedName: QualifiedName) =>
        parameterCallSemaphore.withPermits(1)(
          Effect.gen(function* () {
            const current = activeParameterCall;

            if (current === undefined) {
              return;
            }

            if (!current.numericIdsByQualifiedName.has(qualifiedName)) {
              return;
            }

            if (current.numericIdsByQualifiedName.size === 1) {
              activeParameterCall = undefined;
              yield* websocketClient.unsubscribe(current.call);
              return;
            }

            yield* websocketClient.sendWithoutReply({
              type: "parameters",
              call: current.call,
              options: {
                instance: yamcsConfig.instance,
                processor: yamcsConfig.processor,
                id: [{ name: qualifiedName }],
                action: "REMOVE",
              },
            });

            current.numericIdsByQualifiedName.delete(qualifiedName);
          }),
        );

      const subscriptionMap = yield* RcMap.make<
        QualifiedName,
        ParameterSubscription,
        ParameterNotFound | Schema.SchemaError,
        Scope.Scope
      >({
        lookup: (qualifiedName) =>
          Effect.acquireRelease(
            Effect.gen(function* () {
              const info = yield* get(qualifiedName);
              const { eventStream, numericId } = yield* ensureSubscribed(qualifiedName);

              const updates = eventStream.pipe(
                Stream.flatMap((event) =>
                  "values" in event ? Stream.fromIterable(event.values) : Stream.empty,
                ),
                Stream.filter((value) => String(value.numericId) === numericId),
                Stream.changesWith((left, right) => parameterValueContentEquivalence(left, right)),
                Stream.map((value) => ({ info, value })),
              );

              return { info, updates };
            }),
            () => unsubscribeParameter(qualifiedName),
          ),
      });

      const subscribe = (qualifiedName: QualifiedName) => RcMap.get(subscriptionMap, qualifiedName);
      return { all, get, subscribe };
    }),
  );
}
