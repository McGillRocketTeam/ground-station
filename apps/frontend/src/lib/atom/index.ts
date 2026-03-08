import {
  BrowserHttpClient,
  BrowserKeyValueStore,
} from "@effect/platform-browser";
import {
  CommandHistoryEvent,
  EventsEvent,
  LinkEvent,
  mergeCommandEntries,
  ParameterEvent,
  ParameterValue,
  QualifiedName,
  SubscribeCommandsRequest,
  SubscribeEventsRequest,
  SubscribeLinksRequest,
  SubscribeParameterRequest,
  SubscribeTimeRequest,
  TimeEvent,
  WebSocketClient,
  YamcsApi,
} from "@mrt/yamcs-effect";
import {
  ConfigProvider,
  Effect,
  Exit,
  Logger,
  Schema,
  Schedule,
  Stream,
  Tracer,
  type Layer,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Atom, AtomHttpApi } from "effect/unstable/reactivity";

type ArchivedCommandHistoryEntry =
  typeof import("@mrt/yamcs-effect").CommandHistoryEntry.Type;
type ArchivedEvent = typeof import("@mrt/yamcs-effect").Event.Type;
type StreamingCommandHistoryEntry =
  typeof import("@mrt/yamcs-effect").StreamingCommandHisotryEntry.Type;

type DecodedMessage<A> = {
  raw: unknown;
  decoded: Exit.Exit<A, Schema.SchemaError>;
};

function logValidationFailure(label: string, error: unknown, raw: unknown) {
  return Effect.sync(() => {
    console.error(`[yamcs] Failed to decode ${label}`, {
      error,
      raw,
    });
  });
}

function isDecodedSuccess<A>(
  message: DecodedMessage<A>,
): message is { raw: unknown; decoded: Exit.Success<A, Schema.SchemaError> } {
  return Exit.isSuccess(message.decoded);
}

function decodeStreamOrLog<A, E, R>(
  stream: Stream.Stream<unknown, E, R>,
  schema: Schema.Schema<A> & { readonly DecodingServices: never },
  label: string,
): Stream.Stream<A, E, R> {
  return stream.pipe(
    Stream.map(
      (raw): DecodedMessage<A> => ({
        raw,
        decoded: Schema.decodeUnknownExit(schema)(raw),
      }),
    ),
    Stream.tap((message) =>
      Exit.isFailure(message.decoded)
        ? logValidationFailure(label, message.decoded.cause, message.raw)
        : Effect.sync(() => undefined),
    ),
    Stream.map((message) =>
      isDecodedSuccess(message) ? [message.decoded.value] : [],
    ),
    Stream.flattenIterable,
  ) as Stream.Stream<A, E, R>;
}

const frontendRuntimeFactory = Atom.context({ memoMap: Atom.defaultMemoMap });
const localStorageRuntime = Atom.runtime(
  BrowserKeyValueStore.layerLocalStorage,
);
const yamcsBaseUrl = import.meta.env.YAMCS_URL;

frontendRuntimeFactory.addGlobalLayer(Logger.layer([Logger.consolePretty()]));
frontendRuntimeFactory.addGlobalLayer(
  ConfigProvider.layer(ConfigProvider.fromUnknown(import.meta.env)),
);

const subscriptionRuntime = frontendRuntimeFactory(WebSocketClient.layer);

export const themeSchema = Schema.Literals(["dark", "light", "system"]);
export type Theme = typeof themeSchema.Type;

export const selectedInstanceAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "mrt-selected-instance",
  schema: Schema.String,
  defaultValue: () => "",
});

export const themeAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "vite-ui-theme",
  schema: themeSchema,
  defaultValue: () => "system" as Theme,
});

export class YamcsAtomHttpClient extends AtomHttpApi.Service<YamcsAtomHttpClient>()(
  "@mrt/frontend/YamcsAtomHttpClient",
  {
    api: YamcsApi,
    httpClient: BrowserHttpClient.layerFetch as Layer.Layer<unknown>,
    runtime: frontendRuntimeFactory,
    transformClient: (client) =>
      client.pipe(
        HttpClient.transformResponse((effect) =>
          Effect.provideService(effect, Tracer.DisablePropagation, true),
        ),
        HttpClient.mapRequest((req) =>
          HttpClientRequest.setUrl(
            new URL(req.url.replaceAll("%3A", ":"), yamcsBaseUrl).toString(),
          )(req),
        ),
        HttpClient.retryTransient({
          times: 3,
          schedule: Schedule.exponential("500 millis", 2),
        }),
      ),
  },
) {}

const timeSubscriptionAtomForInstance = Atom.family((instance: string) =>
  subscriptionRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const ws = yield* WebSocketClient;
        const { call, stream } = yield* ws.subscribe(
          SubscribeTimeRequest.makeUnsafe({
            instance,
            processor: "realtime",
          }),
        );

        return stream.pipe(
          (stream) =>
            decodeStreamOrLog(
              stream,
              TimeEvent,
              `time subscription (${instance})`,
            ),
          Stream.map((message) => message.data),
          Stream.ensuring(ws.unsubscribe(call)),
        );
      }),
    ),
  ),
);

const linksSubscriptionAtomForInstance = Atom.family((instance: string) =>
  subscriptionRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const ws = yield* WebSocketClient;
        const { call, stream } = yield* ws.subscribe(
          SubscribeLinksRequest.makeUnsafe({ instance }),
        );

        return stream.pipe(
          (stream) =>
            decodeStreamOrLog(
              stream,
              LinkEvent,
              `links subscription (${instance})`,
            ),
          Stream.map((message) => message.data.links),
          Stream.ensuring(ws.unsubscribe(call)),
        );
      }),
    ),
  ),
);

const commandsSubscriptionAtomForInstance = Atom.family((instance: string) =>
  subscriptionRuntime.atom((get) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const ws = yield* WebSocketClient;
        const { commands: priorCommands } = yield* Effect.orElseSucceed(
          Effect.tapError(
            get.result(
              YamcsAtomHttpClient.query("command", "listCommands", {
                params: { instance },
              }),
            ),
            (error) =>
              logValidationFailure(
                `command history archive query (${instance})`,
                error,
                { instance },
              ),
          ),
          () => ({
            commands: [] as ReadonlyArray<ArchivedCommandHistoryEntry>,
          }),
        );

        const { call, stream } = yield* ws.subscribe(
          SubscribeCommandsRequest.makeUnsafe({
            instance,
            processor: "realtime",
          }),
        );

        const initial = new Map<string, StreamingCommandHistoryEntry>(
          priorCommands.map((command: ArchivedCommandHistoryEntry) => [
            command.id,
            command as StreamingCommandHistoryEntry,
          ]),
        );

        const dataStream = stream.pipe(
          (stream) =>
            decodeStreamOrLog(
              stream,
              CommandHistoryEvent,
              `command history subscription (${instance})`,
            ),
          Stream.map((message) => message.data),
          Stream.ensuring(ws.unsubscribe(call)),
        );

        return dataStream.pipe(
          Stream.scanEffect(
            initial,
            (state, commandEntry: StreamingCommandHistoryEntry) =>
              Effect.sync(() => {
                const current = state.get(commandEntry.id);

                if (current) {
                  state.set(
                    commandEntry.id,
                    mergeCommandEntries(current, commandEntry),
                  );
                } else {
                  state.set(commandEntry.id, commandEntry);
                }

                return state;
              }),
          ),
          Stream.map((state) =>
            Array.from(state.values()).sort(
              (a, b) =>
                b.generationTime.epochMillis - a.generationTime.epochMillis,
            ),
          ),
        );
      }),
    ),
  ),
);

const parameterSubscriptionAtomForInstance = Atom.family(
  ({
    instance,
    qualifiedName,
  }: {
    instance: string;
    qualifiedName: QualifiedName;
  }) =>
    subscriptionRuntime.atom(
      Stream.unwrap(
        Effect.gen(function* () {
          const ws = yield* WebSocketClient;
          const { call, stream } = yield* ws.subscribe(
            SubscribeParameterRequest.makeUnsafe({
              instance,
              processor: "realtime",
              id: [{ name: qualifiedName }],
            }),
          );

          const eventStream = decodeStreamOrLog(
            Stream.map(stream, (message) => message.data),
            ParameterEvent,
            `parameter subscription (${instance}:${qualifiedName})`,
          );

          const mappingEvents = yield* eventStream.pipe(
            Stream.filter((event) => "mapping" in event),
            Stream.take(1),
            Stream.runCollect,
          );

          const mapping = Array.from(mappingEvents)[0]!.mapping;

          return eventStream.pipe(
            Stream.filter((event) => "values" in event),
            Stream.map(({ values }) =>
              Object.fromEntries(
                values.map((value) => {
                  const key = mapping[value.numericId]?.name;
                  return [key, value];
                }),
              ),
            ),
            Stream.map(
              (valuesByName) =>
                valuesByName[qualifiedName] as typeof ParameterValue.Type,
            ),
            Stream.ensuring(ws.unsubscribe(call)),
          );
        }),
      ),
    ),
);

const eventsSubscriptionAtomForInstance = Atom.family((instance: string) =>
  subscriptionRuntime.atom((get) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const ws = yield* WebSocketClient;
        const priorEvents: Array<ArchivedEvent> = [];
        let next: string | undefined;

        while (true) {
          const response = yield* Effect.orElseSucceed(
            Effect.tapError(
              get.result(
                YamcsAtomHttpClient.query("event", "listEvents", {
                  params: { instance },
                  query: next ? { next } : {},
                }),
              ),
              (error) =>
                logValidationFailure(
                  `events archive query (${instance})`,
                  error,
                  {
                    instance,
                    next,
                  },
                ),
            ),
            () => ({
              events: [] as ReadonlyArray<ArchivedEvent>,
              continuationToken: undefined,
            }),
          );

          priorEvents.push(...response.events);

          if (!response.continuationToken) {
            break;
          }

          next = response.continuationToken;
        }

        const { call, stream } = yield* ws.subscribe(
          SubscribeEventsRequest.makeUnsafe({ instance }),
        );

        const initial = [...priorEvents].reverse();

        return Stream.concat(
          Stream.succeed(initial),
          stream.pipe(
            (stream) =>
              decodeStreamOrLog(
                stream,
                EventsEvent,
                `events subscription (${instance})`,
              ),
            Stream.scan(initial, (allEvents, event) => [
              ...allEvents,
              event.data,
            ]),
            Stream.ensuring(ws.unsubscribe(call)),
          ),
        );
      }),
    ),
  ),
);

export const timeSubscriptionAtom = Atom.make((get) =>
  get(timeSubscriptionAtomForInstance(get(selectedInstanceAtom))),
);

export const linksSubscriptionAtom = Atom.make((get) =>
  get(linksSubscriptionAtomForInstance(get(selectedInstanceAtom))),
);

export const commandsSubscriptionAtom = Atom.make((get) =>
  get(commandsSubscriptionAtomForInstance(get(selectedInstanceAtom))),
);

export const parameterSubscriptionAtom = Atom.family(
  (qualifiedName: QualifiedName) =>
    Atom.make((get) =>
      get(
        parameterSubscriptionAtomForInstance({
          instance: get(selectedInstanceAtom),
          qualifiedName,
        }),
      ),
    ),
);

export const eventsSubscriptionAtom = Atom.make((get) =>
  get(eventsSubscriptionAtomForInstance(get(selectedInstanceAtom))),
);
