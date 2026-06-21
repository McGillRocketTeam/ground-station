import {
  Context,
  Data,
  DateTime,
  Effect,
  Layer,
  RcMap,
  Schema,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { HttpApiClient } from "effect/unstable/httpapi";
import { Socket } from "effect/unstable/socket";

import { YamcsApi } from "../http/index.ts";
import {
  CommandHistoryEntry,
  CommandInfo,
  type QualifiedName,
  IssueCommandRequest,
  IssueCommandResponse,
  StreamingCommandHisotryEntry,
} from "../schema.ts";
import { mergeCommandEntries } from "../utils.ts";
import { SubscribeCommandsRequest } from "../websocket/client-messages.ts";
import { YamcsWebSocketClient } from "../websocket/client.ts";
import { CommandHistoryEvent } from "../websocket/server-messages.ts";
import { YamcsConfig } from "../yamcs-config.ts";

export class CommandNotFound extends Data.TaggedError("CommandNotFound")<{
  readonly qualifiedName: QualifiedName;
}> {}

export class CommandServiceError extends Data.TaggedError("CommandServiceError")<{
  readonly operation: "initialize" | "subscribeHistory" | "send";
  readonly qualifiedName?: QualifiedName | undefined;
  readonly cause: unknown;
}> {}

export interface SentCommandSubscription {
  readonly result: typeof IssueCommandResponse.Type;
  readonly updates: Stream.Stream<typeof StreamingCommandHisotryEntry.Type, CommandServiceError>;
}

export interface CommandHistorySubscription {
  readonly entries: Stream.Stream<
    ReadonlyArray<typeof StreamingCommandHisotryEntry.Type>,
    CommandServiceError
  >;
}

export interface SendCommandOptions {
  readonly qualifiedName: QualifiedName;
  readonly request?: typeof IssueCommandRequest.Type | undefined;
}

interface CommandHistoryStore {
  readonly entriesById: SubscriptionRef.SubscriptionRef<
    ReadonlyMap<string, typeof StreamingCommandHisotryEntry.Type>
  >;
}

const historyStoreKey = Symbol.for("@mrt/yamcs-effect/Commands/history-store");

const sortEntries = (entriesById: ReadonlyMap<string, typeof StreamingCommandHisotryEntry.Type>) =>
  Array.from(entriesById.values()).sort(
    (left, right) =>
      DateTime.toEpochMillis(right.generationTime) - DateTime.toEpochMillis(left.generationTime),
  );

const mergeEntryIntoState = (
  entriesById: ReadonlyMap<string, typeof StreamingCommandHisotryEntry.Type>,
  entry: typeof StreamingCommandHisotryEntry.Type,
) => {
  const next = new Map(entriesById);
  const current = next.get(entry.id);

  next.set(entry.id, current ? mergeCommandEntries(current, entry) : entry);
  return next;
};

const toStreamingHistoryEntry = (entry: typeof CommandHistoryEntry.Type) =>
  entry as typeof StreamingCommandHisotryEntry.Type;

export class Commands extends Context.Service<
  Commands,
  {
    readonly list: Effect.Effect<ReadonlyArray<typeof CommandInfo.Type>>;
    readonly get: (
      qualifiedName: QualifiedName,
    ) => Effect.Effect<typeof CommandInfo.Type, CommandNotFound>;
    readonly subscribeHistory: () => Effect.Effect<
      CommandHistorySubscription,
      CommandServiceError,
      Scope.Scope
    >;
    readonly send: (
      options: SendCommandOptions,
    ) => Effect.Effect<SentCommandSubscription, CommandNotFound | CommandServiceError, Scope.Scope>;
  }
>()("@mrt/yamcs-effect/Commands") {
  static readonly layer = Layer.provide(
    Layer.effect(
      Commands,
      Effect.gen(function* () {
        const websocketClient = yield* YamcsWebSocketClient;
        const yamcsConfig = yield* YamcsConfig;
        const httpClient = yield* HttpApiClient.make(YamcsApi);

        const { commands: all } = yield* httpClient.mdb.listCommands({
          params: { instance: yamcsConfig.instance },
          query: { limit: "400" },
        });

        const commandInfoByQualifiedName = new Map(
          all.map((command) => [command.qualifiedName, command] as const),
        );

        const get = (qualifiedName: QualifiedName) =>
          Effect.gen(function* () {
            const commandInfo = commandInfoByQualifiedName.get(qualifiedName);

            if (commandInfo === undefined) {
              return yield* new CommandNotFound({ qualifiedName });
            }

            return commandInfo;
          });

        const historyStoreMap = yield* RcMap.make<
          typeof historyStoreKey,
          CommandHistoryStore,
          Schema.SchemaError | Socket.SocketError,
          Scope.Scope
        >({
          lookup: () =>
            Effect.acquireRelease(
              Effect.gen(function* () {
                const priorCommandResponse = yield* Effect.orElseSucceed(
                  httpClient.command.listCommands({
                    params: { instance: yamcsConfig.instance },
                  }),
                  () => ({
                    commands: [] as ReadonlyArray<typeof CommandHistoryEntry.Type>,
                  }),
                );

                const priorCommands =
                  ("commands" in priorCommandResponse
                    ? priorCommandResponse.commands
                    : undefined) ??
                  ("entry" in priorCommandResponse ? priorCommandResponse.entry : undefined) ??
                  [];

                let initialEntriesById = new Map<
                  string,
                  typeof StreamingCommandHisotryEntry.Type
                >();

                for (const command of priorCommands) {
                  initialEntriesById = mergeEntryIntoState(
                    initialEntriesById,
                    toStreamingHistoryEntry(command),
                  );
                }

                const entriesById =
                  yield* SubscriptionRef.make<
                    ReadonlyMap<string, typeof StreamingCommandHisotryEntry.Type>
                  >(initialEntriesById);

                const { call, stream } = yield* websocketClient.subscribe(
                  SubscribeCommandsRequest.make({
                    instance: yamcsConfig.instance,
                    processor: yamcsConfig.processor,
                  }),
                );

                yield* stream.pipe(
                  Stream.mapEffect((message) =>
                    Schema.decodeUnknownEffect(CommandHistoryEvent)(message),
                  ),
                  Stream.map((message) => message.data),
                  Stream.runForEach((commandEntry) =>
                    SubscriptionRef.update(entriesById, (current) =>
                      mergeEntryIntoState(current, commandEntry),
                    ),
                  ),
                  Effect.forkScoped,
                );

                return {
                  call,
                  store: { entriesById } satisfies CommandHistoryStore,
                };
              }),
              ({ call }) =>
                Effect.orElseSucceed(websocketClient.unsubscribe(call), () => undefined),
            ).pipe(Effect.map(({ store }) => store)),
        });

        const getHistoryStore = () => RcMap.get(historyStoreMap, historyStoreKey);

        const subscribeHistory = () =>
          Effect.map(
            Effect.mapError(
              getHistoryStore(),
              (cause) => new CommandServiceError({ operation: "subscribeHistory", cause }),
            ),
            (store) =>
              ({
                entries: SubscriptionRef.changes(store.entriesById).pipe(
                  Stream.map(sortEntries),
                  Stream.mapError(
                    (cause) => new CommandServiceError({ operation: "subscribeHistory", cause }),
                  ),
                ),
              }) satisfies CommandHistorySubscription,
          );

        const send = (options: SendCommandOptions) =>
          Effect.gen(function* () {
            yield* get(options.qualifiedName);
            return yield* Effect.mapError(
              Effect.gen(function* () {
                const store = yield* getHistoryStore();

                const result = yield* httpClient.command.issueCommand({
                  params: {
                    instance: yamcsConfig.instance,
                    processor: yamcsConfig.processor,
                    name: options.qualifiedName,
                  },
                  payload: options.request,
                });

                const updates = SubscriptionRef.changes(store.entriesById).pipe(
                  Stream.map((entriesById) => entriesById.get(result.id)),
                  Stream.filter((entry) => entry !== undefined),
                  Stream.changes,
                  Stream.mapError(
                    (cause) =>
                      new CommandServiceError({
                        operation: "send",
                        qualifiedName: options.qualifiedName,
                        cause,
                      }),
                  ),
                );

                return {
                  result,
                  updates,
                } satisfies SentCommandSubscription;
              }),
              (cause) =>
                new CommandServiceError({
                  operation: "send",
                  qualifiedName: options.qualifiedName,
                  cause,
                }),
            );
          });

        return {
          list: Effect.succeed(all),
          get,
          subscribeHistory,
          send,
        };
      }).pipe(
        Effect.mapError((cause) => new CommandServiceError({ operation: "initialize", cause })),
      ),
    ),
    YamcsWebSocketClient.layer,
  );
}
