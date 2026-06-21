import { Context, Data, Effect, Layer, PubSub, Schema, Stream } from "effect";
import { Socket } from "effect/unstable/socket";

import { YamcsConfig } from "../yamcs-config.ts";
import { Cancel, type SubscriptionRequest } from "./client-messages.js";
import { Events, Reply, Messages as ServerMessages, SubscriptionId } from "./server-messages.js";

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
      let id = SubscriptionId.make(1);
      const decoder = new TextDecoder();
      const messagePubSub = yield* Effect.acquireRelease(
        PubSub.unbounded<typeof ServerMessages.Type>({ replay: 128 }),
        PubSub.shutdown,
      );

      const writeMessage = (data: Record<string, any>) => write(JSON.stringify(data));

      yield* socket
        .runRaw(
          (payload) =>
            Effect.sync(() => {
              const text = typeof payload === "string" ? payload : decoder.decode(payload);

              try {
                const parsed = Schema.decodeUnknownOption(ServerMessages)(JSON.parse(text));

                if (parsed._tag === "Some") {
                  PubSub.publishUnsafe(messagePubSub, parsed.value);
                }
              } catch (cause) {
                throw new WebSocketError({ cause });
              }
            }),
          {
            onOpen: Effect.orDie(
              Effect.gen(function* () {
                yield* writeMessage({ id, type: "status" });
                id++;
                yield* Effect.log("WebSocket Opened");
              }),
            ),
          },
        )
        .pipe(Effect.forkScoped);

      const messages = Stream.fromPubSub(messagePubSub);

      yield* messages.pipe(
        Stream.runForEach((message) =>
          Effect.logDebug(`Websocket Message (${message.type})`, message),
        ),
        Effect.forkScoped,
      );

      const send = (data: Record<string, any>) =>
        Effect.gen(function* () {
          const messageId = id++;
          yield* Effect.logDebug(`Sending Message ${data.type}`, data);
          yield* writeMessage({ ...data, id: messageId });

          const replyMessage = yield* messages.pipe(
            Stream.filter(Schema.is(Reply)),
            Stream.filter((message) => message.data.replyTo === messageId),
            Stream.takeUntil(
              (message) => message.type === "reply" && message.data.replyTo === messageId,
            ),
            Stream.runCollect,
          );

          const reply = replyMessage[0]!;

          if (reply.data.exception) {
            yield* Effect.logError(
              `${reply.data.exception.code} ${reply.data.exception.type} for type "${data.type}"`,
              reply.data.exception.msg,
            );
          }

          return reply.call!;
        });

      const sendWithoutReply = (data: Record<string, any>) =>
        Effect.gen(function* () {
          const messageId = id++;
          yield* Effect.logDebug(`Sending Streaming Message ${data.type}`, data);
          yield* writeMessage({ ...data, id: messageId });
        });

      const subscribe = Effect.fnUntraced(function* (request: typeof SubscriptionRequest.Type) {
        const { _tag, ...data } = request;

        const call = yield* send({
          type: _tag,
          options: data,
        });

        const stream = messages.pipe(
          Stream.filter(Schema.is(Events)),
          Stream.filter((message) => message.call === call),
        );

        return { call, stream };
      });

      const unsubscribe = Effect.fnUntraced(function* (call: SubscriptionId) {
        yield* writeMessage(
          Cancel.make({
            type: "cancel",
            options: { call },
          }),
        );
      });

      return { messages, send, sendWithoutReply, subscribe, unsubscribe };
    }),
  );
}

export type WebSocketClientService = YamcsWebSocketClientService;
export const WebSocketClient = YamcsWebSocketClient;
