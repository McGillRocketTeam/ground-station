import {
  Config,
  Data,
  Effect,
  Layer,
  PubSub,
  Schema,
  ServiceMap,
  Stream,
} from "effect";

import { Cancel, type SubscriptionRequest } from "./client-messages.js";
import {
  Events,
  Reply,
  Messages as ServerMessages,
  SubscriptionId,
} from "./server-messages.js";

export interface WebSocketClientService {
  readonly messages: Stream.Stream<typeof ServerMessages.Type>;
  readonly send: (data: Record<string, any>) => Effect.Effect<SubscriptionId>;
  readonly subscribe: (
    request: typeof SubscriptionRequest.Type,
  ) => Effect.Effect<{
    call: SubscriptionId;
    stream: Stream.Stream<typeof Events.Type>;
  }>;
  readonly unsubscribe: (call: SubscriptionId) => Effect.Effect<void>;
}

export class WebSocketError extends Data.TaggedError("WebSocketError")<{
  readonly cause: unknown;
}> {}

export class WebSocketClient extends ServiceMap.Service<
  WebSocketClient,
  WebSocketClientService
>()("@mrt/yamcs-effect/WebSocketClient") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const yamcsUrl = yield* Config.url("YAMCS_URL");
      const websocketUrl = new URL("api/websocket", yamcsUrl);
      websocketUrl.protocol = yamcsUrl.protocol === "https:" ? "wss:" : "ws:";
      let id = SubscriptionId.makeUnsafe(1);
      const messagePubSub = yield* Effect.acquireRelease(
        PubSub.unbounded<typeof ServerMessages.Type>({ replay: 128 }),
        PubSub.shutdown,
      );

      // Socket will be automatically closed when the scope ends.
      const ws = yield* Effect.acquireRelease(
        Effect.try({
          try: () => new WebSocket(websocketUrl),
          catch: (cause) => new WebSocketError({ cause }),
        }),
        (ws) =>
          Effect.gen(function* () {
            yield* Effect.log("Closing Websocket");
            yield* Effect.sync(() => {
              ws.close();
            });
          }),
      );

      ws.addEventListener("message", (event: MessageEvent) => {
        const parsed = Schema.decodeUnknownOption(ServerMessages)(
          JSON.parse(event.data as string),
        );

        if (parsed._tag === "Some") {
          PubSub.publishUnsafe(messagePubSub, parsed.value);
        }
      });

      const messages = Stream.fromPubSub(messagePubSub);

      // Wait for the open event
      yield* Effect.callback<void>((resume) => {
        ws.addEventListener("open", (_event) => {
          ws.send(JSON.stringify({ id, type: "status" }));
          id++;
          resume(Effect.log("WebSocket Opened"));
        });
      });

      yield* messages.pipe(
        Stream.runForEach((message) =>
          Effect.logInfo(`Websocket Message (${message.type})`, message),
        ),
        Effect.forkScoped,
      );

      const send = (data: Record<string, any>) =>
        Effect.gen(function* () {
          const messageId = id++;
          yield* Effect.logDebug(`Sending Message ${data.type}`, data);
          yield* Effect.sync(() =>
            ws.send(JSON.stringify({ ...data, id: messageId })),
          );

          // we wait in this effect until we get a reply with the call id
          // this way we can return it and know the call id for future messages.
          const replyMessage = yield* messages.pipe(
            Stream.filter(Schema.is(Reply)),
            Stream.filter((m) => m.data.replyTo === messageId),
            Stream.takeUntil(
              (m) => m.type === "reply" && m.data.replyTo === messageId,
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

          yield* Effect.logInfo(`${reply.call}`);
          return reply.call!;
        });

      const subscribe = Effect.fnUntraced(function* (
        request: typeof SubscriptionRequest.Type,
      ) {
        const { _tag, ...data } = request;

        const call = yield* send({
          type: _tag,
          options: data,
        });

        const stream = messages.pipe(
          Stream.filter(Schema.is(Events)),
          Stream.filter((s) => s.call === call),
          Stream.tap(Effect.logWarning),
        );

        return { call, stream };
      });

      const unsubscribe = Effect.fnUntraced(function* (call: SubscriptionId) {
        yield* Effect.sync(() =>
          ws.send(
            JSON.stringify(
              Cancel.makeUnsafe({
                type: "cancel",
                options: { call },
              }),
            ),
          ),
        );
      });

      return { messages, send, subscribe, unsubscribe };
    }),
  );
}
