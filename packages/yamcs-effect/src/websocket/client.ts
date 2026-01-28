import { Chunk, Effect, Schema, Stream, StreamEmit } from "effect";
import { Cancel, type SubscriptionRequest } from "./client-messages";
import {
  Events,
  Reply,
  Messages as ServerMessages,
  SubscriptionId,
} from "./server-messages";

export class WebSocketClient extends Effect.Service<WebSocketClient>()(
  "WebSocketClient",
  {
    accessors: true,
    dependencies: [],
    scoped: Effect.gen(function* () {
      let id = SubscriptionId.make(1);

      // Socket will be automatically closed when the scope ends.
      const ws = yield* Effect.acquireRelease(
        Effect.gen(function* () {
          return yield* Effect.try(
            () => new WebSocket("ws://localhost:8090/api/websocket"),
          );
        }),
        (ws) =>
          Effect.gen(function* () {
            yield* Effect.log("Closing Websocket");
            yield* Effect.sync(() => {
              ws.close();
            });
          }),
      );

      // Wait for the open event
      yield* Effect.async((resume) => {
        ws.addEventListener("open", (event) => {
          ws.send(JSON.stringify({ id, type: "status" }));
          id++;

          resume(
            Effect.gen(function* () {
              yield* Effect.log("WebSocket Opened");
              yield* Effect.succeed(event);
            }),
          );
        });
      });

      const messages = Stream.async(
        (emit: StreamEmit.Emit<never, never, string, void>) => {
          ws.addEventListener("message", (event: MessageEvent) => {
            emit(Effect.succeed(Chunk.of(event.data)));
          });
        },
      ).pipe(
        Stream.filterMap((m) =>
          Schema.decodeOption(ServerMessages)(JSON.parse(m)),
        ),
      );

      yield* messages.pipe(
        Stream.runForEachScoped((message) =>
          Effect.logDebug(`Websocket Message (${message.type})`, message),
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

          const reply = Chunk.toReadonlyArray(replyMessage)[0]!;

          if (reply.data.exception) {
            yield* Effect.logError(
              `${reply.data.exception.code} ${reply.data.exception.type} for type "${data.type}"`,
              reply.data.exception.msg,
            );
          }

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
        );

        return { call, stream };
      });

      const unsubscribe = Effect.fnUntraced(function* (call: SubscriptionId) {
        yield* Effect.sync(() =>
          ws.send(
            JSON.stringify(
              Cancel.make({
                type: "cancel",
                options: { call },
              }),
            ),
          ),
        );
      });

      return { messages, send, subscribe, unsubscribe };
    }),
  },
) {}
