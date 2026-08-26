import { Context, Data, Effect, Layer, PubSub, Schedule, Schema, Semaphore, Stream } from "effect";
import { Socket } from "effect/unstable/socket";

import { YamcsConfig } from "../yamcs-config.ts";
import { Cancel, type SubscriptionRequest } from "./client-messages.js";
import {
  Events,
  Reply,
  Messages as ServerMessages,
  type SubscriptionId,
} from "./server-messages.js";

export interface YamcsWebSocketClientService {
  readonly messages: Stream.Stream<typeof ServerMessages.Type>;
  readonly send: (data: Record<string, any>) => Effect.Effect<SubscriptionId, Socket.SocketError>;
  readonly sendWithoutReply: (data: Record<string, any>) => Effect.Effect<void, Socket.SocketError>;
  readonly subscribe: (request: typeof SubscriptionRequest.Type) => Effect.Effect<
    {
      call: SubscriptionId;
      stream: Stream.Stream<typeof Events.Type>;
    },
    Socket.SocketError
  >;
  readonly unsubscribe: (call: SubscriptionId) => Effect.Effect<void, Socket.SocketError>;
}

export class WebSocketError extends Data.TaggedError("WebSocketError")<{
  readonly cause: unknown;
}> {}

export class YamcsWebSocketClient extends Context.Service<
  YamcsWebSocketClient,
  YamcsWebSocketClientService
>()("@mrt/yamcs-effect/YamcsWebSocketClient") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const yamcsConfig = yield* YamcsConfig;
      const websocketUrl = new URL("api/websocket", yamcsConfig.url);
      websocketUrl.protocol = yamcsConfig.url.protocol === "https:" ? "wss:" : "ws:";

      const socket = yield* Socket.makeWebSocket(websocketUrl.toString());
      const write = yield* socket.writer;
      let nextMessageId = 1;
      let nextLogicalCall = 1;
      let connectionGeneration = 0;
      const decoder = new TextDecoder();
      const rawMessagePubSub = yield* Effect.acquireRelease(
        PubSub.unbounded<typeof ServerMessages.Type>({ replay: 128 }),
        PubSub.shutdown,
      );
      const messagePubSub = yield* Effect.acquireRelease(
        PubSub.unbounded<typeof ServerMessages.Type>({ replay: 128 }),
        PubSub.shutdown,
      );
      const disconnectPubSub = yield* Effect.acquireRelease(
        PubSub.unbounded<number>({ replay: 1 }),
        PubSub.shutdown,
      );
      const writeSemaphore = yield* Semaphore.make(1);
      type SubscriptionReplayMessage = Record<string, any>;
      const subscriptions = new Map<
        SubscriptionId,
        {
          request: typeof SubscriptionRequest.Type;
          serverCall: SubscriptionId | undefined;
          replayMessages: Array<SubscriptionReplayMessage>;
        }
      >();
      const logicalCallByServerCall = new Map<SubscriptionId, SubscriptionId>();

      const writeMessage = (data: Record<string, any>) => write(JSON.stringify(data));
      const disconnectedBeforeReply = () =>
        new Socket.SocketError({
          reason: new Socket.SocketCloseError({
            code: 1006,
            closeReason: "WebSocket disconnected before reply",
          }),
        });

      const publishMessage = (message: typeof ServerMessages.Type) =>
        Effect.sync(() => {
          PubSub.publishUnsafe(rawMessagePubSub, message);

          if (!("call" in message) || message.call === undefined) {
            PubSub.publishUnsafe(messagePubSub, message);
            return;
          }

          const logicalCall = logicalCallByServerCall.get(message.call);

          if (logicalCall === undefined) {
            return;
          }

          PubSub.publishUnsafe(messagePubSub, { ...message, call: logicalCall });
        });

      const awaitReply = (messageId: number, generation: number) =>
        Effect.raceFirst(
          Stream.fromPubSub(rawMessagePubSub).pipe(
            Stream.filter(Schema.is(Reply)),
            Stream.filter((message) => message.data.replyTo === messageId),
            Stream.take(1),
            Stream.runCollect,
            Effect.map((messages) => messages[0]!),
          ),
          Stream.fromPubSub(disconnectPubSub).pipe(
            Stream.filter((currentGeneration) => currentGeneration > generation),
            Stream.take(1),
            Stream.runCollect,
            Effect.flatMap(() => Effect.fail(disconnectedBeforeReply())),
          ),
        );

      const sendRawUnlocked = (data: Record<string, any>) =>
        Effect.gen(function* () {
          const messageId = nextMessageId++;
          const generation = connectionGeneration;

          yield* Effect.logDebug(`Sending Message ${data.type}`, data);
          yield* writeMessage({ ...data, id: messageId });

          return yield* awaitReply(messageId, generation).pipe(
            Effect.timeoutOrElse({
              duration: "5 seconds",
              orElse: () => Effect.fail(disconnectedBeforeReply()),
            }),
          );
        });

      const sendRaw = (data: Record<string, any>) =>
        writeSemaphore
          .withPermits(1)(sendRawUnlocked(data))
          .pipe(Effect.retry({ schedule: Schedule.spaced("1 second") }));

      const sendWithoutReplyRawUnlocked = (data: Record<string, any>) =>
        Effect.gen(function* () {
          const messageId = nextMessageId++;

          yield* Effect.logDebug(`Sending Streaming Message ${data.type}`, data);
          yield* writeMessage({
            ...data,
            id: messageId,
          }).pipe(
            Effect.timeoutOrElse({
              duration: "5 seconds",
              orElse: () => Effect.fail(disconnectedBeforeReply()),
            }),
          );
        });

      const replaySubscriptions = writeSemaphore.withPermits(1)(
        Effect.gen(function* () {
          const statusMessageId = nextMessageId++;
          yield* writeMessage({ id: statusMessageId, type: "status" });

          for (const [logicalCall, subscription] of subscriptions) {
            const request = subscription.request as typeof SubscriptionRequest.Type & {
              readonly _tag: string;
            };
            const { _tag, ...data } = request;

            yield* Effect.logDebug(`Replaying Message ${_tag}`, data);
            const reply = yield* sendRawUnlocked({ type: _tag, options: data });

            if (reply.data.exception) {
              yield* Effect.logError(
                `${reply.data.exception.code} ${reply.data.exception.type} for type "${_tag}"`,
                reply.data.exception.msg,
              );
            }

            const previousServerCall = subscription.serverCall;
            if (previousServerCall !== undefined) {
              logicalCallByServerCall.delete(previousServerCall);
            }

            if (!subscriptions.has(logicalCall)) {
              continue;
            }

            subscription.serverCall = reply.call;
            if (reply.call !== undefined) {
              logicalCallByServerCall.set(reply.call, logicalCall);
            }

            for (const replayMessage of subscription.replayMessages) {
              yield* sendWithoutReplyRawUnlocked({
                ...replayMessage,
                call: reply.call ?? replayMessage.call,
              });
            }
          }

          yield* Effect.log("WebSocket Opened");
        }),
      );

      yield* Effect.forever(
        Effect.gen(function* () {
          yield* socket
            .runRaw(
              (payload) => {
                const text = typeof payload === "string" ? payload : decoder.decode(payload);

                return Effect.try({
                  try: () => Schema.decodeUnknownOption(ServerMessages)(JSON.parse(text)),
                  catch: (cause) => new WebSocketError({ cause }),
                }).pipe(
                  Effect.flatMap((parsed) =>
                    parsed._tag === "Some" ? publishMessage(parsed.value) : Effect.void,
                  ),
                );
              },
              {
                onOpen: Effect.orDie(replaySubscriptions),
              },
            )
            .pipe(
              Effect.tapError((error) => Effect.logWarning("WebSocket connection lost", error)),
              Effect.ignore,
            );

          yield* Effect.sync(() => {
            connectionGeneration += 1;
            logicalCallByServerCall.clear();

            for (const subscription of subscriptions.values()) {
              subscription.serverCall = undefined;
            }

            PubSub.publishUnsafe(disconnectPubSub, connectionGeneration);
          });

          yield* Effect.sleep("1 second");
        }),
      ).pipe(Effect.forkScoped);

      const messages = Stream.fromPubSub(messagePubSub);

      yield* messages.pipe(
        Stream.runForEach((message) =>
          Effect.logDebug(`Websocket Message (${message.type})`, message),
        ),
        Effect.forkScoped,
      );

      const send = (data: Record<string, any>) =>
        Effect.gen(function* () {
          const reply = yield* sendRaw(data);

          if (reply.data.exception) {
            yield* Effect.logError(
              `${reply.data.exception.code} ${reply.data.exception.type} for type "${data.type}"`,
              reply.data.exception.msg,
            );
          }

          return reply.call!;
        });

      const sendWithoutReply = (data: Record<string, any>) =>
        writeSemaphore
          .withPermits(1)(
            Effect.gen(function* () {
              const logicalCall =
                typeof data.call === "number" ? (data.call as SubscriptionId) : undefined;
              const subscription =
                logicalCall === undefined ? undefined : subscriptions.get(logicalCall);
              const normalizedData = {
                ...data,
                call: subscription?.serverCall ?? data.call,
              };

              if (subscription !== undefined) {
                subscription.replayMessages.push({ ...data });
              }

              yield* sendWithoutReplyRawUnlocked(normalizedData).pipe(
                Effect.onError(() =>
                  Effect.sync(() => {
                    subscription?.replayMessages.pop();
                  }),
                ),
              );
            }),
          )
          .pipe(Effect.retry({ schedule: Schedule.spaced("1 second") }));

      const subscribe = Effect.fnUntraced(function* (request: typeof SubscriptionRequest.Type) {
        const logicalCall = nextLogicalCall as SubscriptionId;
        nextLogicalCall += 1;

        subscriptions.set(logicalCall, { request, serverCall: undefined, replayMessages: [] });

        const taggedRequest = request as typeof SubscriptionRequest.Type & {
          readonly _tag: string;
        };
        const { _tag, ...data } = taggedRequest;

        const call = yield* send({
          type: _tag,
          options: data,
        }).pipe(
          Effect.tap((serverCall) =>
            Effect.sync(() => {
              const subscription = subscriptions.get(logicalCall);

              if (subscription === undefined) {
                return;
              }

              subscription.serverCall = serverCall;
              logicalCallByServerCall.set(serverCall, logicalCall);
            }),
          ),
          Effect.map(() => logicalCall),
          Effect.onError(() =>
            Effect.sync(() => {
              subscriptions.delete(logicalCall);
            }),
          ),
        );

        const stream = messages.pipe(
          Stream.filter(Schema.is(Events)),
          Stream.filter((message) => message.call === call),
        );

        return { call, stream };
      });

      const unsubscribe = Effect.fnUntraced(function* (call: SubscriptionId) {
        const serverCall = subscriptions.get(call)?.serverCall;

        subscriptions.delete(call);

        if (serverCall !== undefined) {
          logicalCallByServerCall.delete(serverCall);
        }

        if (serverCall === undefined) {
          return;
        }

        yield* writeSemaphore.withPermits(1)(
          writeMessage(
            Cancel.make({
              type: "cancel",
              options: { call: serverCall },
            }),
          ).pipe(
            Effect.timeoutOrElse({
              duration: "100 millis",
              orElse: () => Effect.void,
            }),
          ),
        );
      });

      return { messages, send, sendWithoutReply, subscribe, unsubscribe };
    }),
  );
}

export type WebSocketClientService = YamcsWebSocketClientService;
export const WebSocketClient = YamcsWebSocketClient;
