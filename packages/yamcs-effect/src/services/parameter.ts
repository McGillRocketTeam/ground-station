import { Context, Data, Effect, Layer, RcMap, Schema, Scope, Semaphore, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { Socket } from "effect/unstable/socket";

import { YamcsApi } from "../http/index.ts";
import { ParameterInfo, type QualifiedName } from "../schema.ts";
import { SubscribeParameterRequest } from "../websocket/client-messages.ts";
import { YamcsWebSocketClient } from "../websocket/client.ts";
import {
  ParameterEvent,
  type ParameterValue,
  type SubscriptionId,
} from "../websocket/server-messages.ts";
import { YamcsConfig } from "../yamcs-config.ts";

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
  readonly qualifiedNames: Set<QualifiedName>;
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
    ) => Effect.Effect<
      ParameterSubscription,
      ParameterNotFound | Schema.SchemaError | Socket.SocketError,
      Scope.Scope
    >;
  }
>()("@mrt/yamcs-effect/Parameters") {
  static readonly layer = Layer.effect(
    Parameters,
    Effect.gen(function* () {
      const websocketClient = yield* YamcsWebSocketClient;
      const yamcsConfig = yield* YamcsConfig;

      const httpClient = yield* HttpApiClient.make(YamcsApi, {
        transformClient: (client) =>
          HttpClient.mapRequest(client, (request) =>
            HttpClientRequest.setUrl(
              request,
              new URL(request.url.replaceAll("%3A", ":"), yamcsConfig.url).toString(),
            ),
          ),
      });

      const { parameters: all } = yield* httpClient.mdb.listParameters({
        params: { instance: yamcsConfig.instance },
        query: { limit: "900", details: true },
      });

      const parameterInfoByQualifiedName = new Map(
        all.map((parameter) => [parameter.qualifiedName, parameter] as const),
      );
      const parameterCallSemaphore = yield* Semaphore.make(1);
      let activeParameterCall: ActiveParameterCall | undefined;

      const findCandidateParameterNames = (qualifiedName: QualifiedName) => {
        const requestedLeaf = qualifiedName.split("/").at(-1)?.toLowerCase();
        const requestedLower = qualifiedName.toLowerCase();

        return all
          .map((parameter) => parameter.qualifiedName)
          .filter((candidate) => {
            const candidateLower = candidate.toLowerCase();
            const candidateLeaf = candidate.split("/").at(-1)?.toLowerCase();

            return (
              candidateLower.includes(requestedLower) ||
              requestedLower.includes(candidateLower) ||
              (requestedLeaf !== undefined && candidateLeaf === requestedLeaf)
            );
          })
          .slice(0, 20);
      };

      const logParameterNotFound = (
        qualifiedName: QualifiedName,
        context: Record<string, unknown>,
      ) =>
        Effect.logWarning("Yamcs parameter not found", {
          qualifiedName,
          instance: yamcsConfig.instance,
          processor: yamcsConfig.processor,
          yamcsUrl: yamcsConfig.url.toString(),
          knownParameterCount: all.length,
          candidateQualifiedNames: findCandidateParameterNames(qualifiedName),
          ...context,
        });

      const get = (qualifiedName: QualifiedName) =>
        Effect.gen(function* () {
          const parameterInfo = parameterInfoByQualifiedName.get(qualifiedName);

          if (parameterInfo === undefined) {
            yield* logParameterNotFound(qualifiedName, {
              source: "Parameters.get",
              lookup: "initial MDB parameter list",
            });
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
            yield* logParameterNotFound(qualifiedName, {
              source: "Parameters.subscribe",
              lookup: "websocket parameter mapping",
            });
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

          yield* awaitNumericId(eventStream, qualifiedName);

          return {
            call,
            eventStream,
            qualifiedNames: new Set([qualifiedName]),
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
              };
            }

            if (current.qualifiedNames.has(qualifiedName)) {
              return {
                eventStream: current.eventStream,
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

            yield* awaitNumericId(current.eventStream, qualifiedName);
            current.qualifiedNames.add(qualifiedName);

            return {
              eventStream: current.eventStream,
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

            if (!current.qualifiedNames.has(qualifiedName)) {
              return;
            }

            if (current.qualifiedNames.size === 1) {
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

            current.qualifiedNames.delete(qualifiedName);
          }),
        );

      const subscriptionMap = yield* RcMap.make<
        QualifiedName,
        ParameterSubscription,
        ParameterNotFound | Schema.SchemaError | Socket.SocketError,
        Scope.Scope
      >({
        lookup: (qualifiedName) =>
          Effect.acquireRelease(
            Effect.gen(function* () {
              const info = yield* get(qualifiedName);
              const { eventStream } = yield* ensureSubscribed(qualifiedName);
              let numericId: string | undefined;

              const updates = eventStream.pipe(
                Stream.flatMap((event) => {
                  if ("mapping" in event) {
                    const mappedNumericId = getNumericIdFromMapping(qualifiedName, event.mapping);

                    if (mappedNumericId !== undefined) {
                      numericId = mappedNumericId;
                    }

                    return Stream.empty;
                  }

                  return Stream.fromIterable(event.values);
                }),
                Stream.filter(
                  (value) => numericId !== undefined && String(value.numericId) === numericId,
                ),
                // Stream.changesWith((left, right) => parameterValueContentEquivalence(left, right)),
                Stream.map((value) => ({ info, value })),
              );

              return { info, updates };
            }),
            () => Effect.orElseSucceed(unsubscribeParameter(qualifiedName), () => undefined),
          ),
      });

      const subscribe = (qualifiedName: QualifiedName) => RcMap.get(subscriptionMap, qualifiedName);
      return { all, get, subscribe };
    }),
  ).pipe(Layer.provide(YamcsWebSocketClient.layer));
}
