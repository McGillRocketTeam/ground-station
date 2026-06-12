import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";

import { BrowserHttpClient, BrowserKeyValueStore } from "@effect/platform-browser";
import {
  ParameterInfo,
  Parameters,
  ParameterValue,
  QualifiedName,
  WebSocketClient,
  YamcsApi,
  YamcsConfig,
  YamcsSubscriptions,
} from "@mrt/yamcs-effect";
import {
  DateTime,
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  Schema,
  Stream,
  Tracer,
  Schedule,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { AsyncResult, Atom, AtomHttpApi } from "effect/unstable/reactivity";

type ArchivedCommandHistoryEntry = typeof import("@mrt/yamcs-effect").CommandHistoryEntry.Type;
type ArchivedEvent = typeof import("@mrt/yamcs-effect").Event.Type;
type ArchivedLink = typeof import("@mrt/yamcs-effect").LinkInfo.Type;
type StreamingCommandHistoryEntry =
  typeof import("@mrt/yamcs-effect").StreamingCommandHisotryEntry.Type;
type AtomRuntimeContext = AtomRegistry.AtomRegistry | Reactivity.Reactivity;

const transformYamcsHttpClient = (client: HttpClient.HttpClient) =>
  client.pipe(
    HttpClient.transformResponse((effect) =>
      Effect.provideService(effect, Tracer.DisablePropagation, true),
    ),
    HttpClient.mapRequest((req) =>
      HttpClientRequest.setUrl(new URL(req.url.replaceAll("%3A", ":"), yamcsBaseUrl).toString())(
        req,
      ),
    ),
    HttpClient.retryTransient({
      times: 3,
      schedule: Schedule.exponential("500 millis", 2),
    }),
  );

const yamcsHttpClientLayer: Layer.Layer<HttpClient.HttpClient> = Layer.provideMerge(
  Layer.effect(HttpClient.HttpClient)(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return transformYamcsHttpClient(client);
    }),
  ),
  BrowserHttpClient.layerFetch as Layer.Layer<HttpClient.HttpClient>,
);

function logValidationFailure(label: string, error: unknown, raw: unknown) {
  return Effect.logError(`[yamcs] Failed to decode ${label}\n${error}`, raw);
}

const frontendRuntimeFactory = Atom.context({ memoMap: Atom.defaultMemoMap });
const localStorageRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage);

function resolveRuntimeUrl(url: string): string {
  const parsedUrl = new URL(url);

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsedUrl.hostname) &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    parsedUrl.hostname = window.location.hostname;
  }

  return parsedUrl.toString();
}

export const yamcsBaseUrl = resolveRuntimeUrl(import.meta.env.YAMCS_URL);
const runtimeEnv = { ...import.meta.env, YAMCS_URL: yamcsBaseUrl };

frontendRuntimeFactory.addGlobalLayer(Logger.layer([Logger.consolePretty()]));
frontendRuntimeFactory.addGlobalLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(runtimeEnv)));

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
    httpClient: yamcsHttpClientLayer as Layer.Layer<unknown>,
    runtime: frontendRuntimeFactory,
  },
) {}

const yamcsSubscriptionRuntime = YamcsAtomHttpClient.runtime.factory(
  (get): Layer.Layer<any, any, AtomRuntimeContext> => {
    const yamcsConfigLayer = Layer.succeed(YamcsConfig, {
      url: new URL(yamcsBaseUrl),
      instance: get(selectedInstanceAtom),
      processor: "realtime",
    });

    const websocketLayer = Layer.provideMerge(WebSocketClient.layer, yamcsConfigLayer);
    const subscriptionsLayer = Layer.provideMerge(YamcsSubscriptions.layer, websocketLayer);
    const parametersLayer = Layer.provideMerge(
      Parameters.layer,
      Layer.merge(websocketLayer, yamcsHttpClientLayer),
    );

    return Layer.merge(subscriptionsLayer, parametersLayer) as Layer.Layer<
      any,
      any,
      AtomRuntimeContext
    >;
  },
);

export interface LiveParameterUpdate {
  readonly info: typeof ParameterInfo.Type;
  readonly value: typeof ParameterValue.Type;
}

export const timeSubscriptionAtom = yamcsSubscriptionRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const subscriptions = yield* YamcsSubscriptions;
      return subscriptions.time;
    }),
  ),
);

export const linksSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = get(selectedInstanceAtom);
      const { links: priorLinks } = yield* Effect.orElseSucceed(
        Effect.tapError(
          get.result(
            YamcsAtomHttpClient.query("link", "listLinks", {
              params: { instance },
            }),
          ),
          (error) =>
            logValidationFailure(`links initial query (${instance})`, error, {
              instance,
            }),
        ),
        () => ({
          links: [] as ReadonlyArray<ArchivedLink>,
        }),
      );
      const subscriptions = yield* YamcsSubscriptions;

      return Stream.concat(Stream.succeed(priorLinks), subscriptions.links);
    }),
  ),
);

export const singleLinkSubscriptionAtom = Atom.family((name: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(linksSubscriptionAtom), (links) =>
      links.find((link) => link.name === name),
    ),
  ),
);

export const commandsSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = get(selectedInstanceAtom);
      const priorCommandResult = yield* Effect.orElseSucceed(
        Effect.tapError(
          get.result(
            YamcsAtomHttpClient.query("command", "listCommands", {
              params: { instance },
            }),
          ),
          (error) =>
            logValidationFailure(`command history archive query (${instance})`, error, {
              instance,
            }),
        ),
        () => ({
          commands: [] as ReadonlyArray<ArchivedCommandHistoryEntry>,
        }),
      );
      const priorCommands =
        ("commands" in priorCommandResult ? priorCommandResult.commands : undefined) ??
        ("entry" in priorCommandResult ? priorCommandResult.entry : undefined) ??
        [];
      const initial = new Map<string, StreamingCommandHistoryEntry>(
        priorCommands.map((command: ArchivedCommandHistoryEntry) => [
          command.id,
          command as StreamingCommandHistoryEntry,
        ]),
      );
      const sortCommands = (state: Map<string, StreamingCommandHistoryEntry>) =>
        Array.from(state.values()).sort((a, b) =>
          DateTime.Order(b.generationTime, a.generationTime),
        );
      const subscriptions = yield* YamcsSubscriptions;

      return Stream.concat(
        Stream.succeed(sortCommands(initial)),
        subscriptions.commands(priorCommands),
      );
    }),
  ),
);

export const parameterInfoAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom(Parameters.use((s) => s.get(qualifiedName))),
);

export const parameterListAtom = yamcsSubscriptionRuntime.atom(
  Parameters.use((s) => Effect.succeed(s.all)),
);

export const parameterSubscriptionAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const parameters = yield* Parameters;
        const subscription = yield* parameters.subscribe(qualifiedName);
        return subscription.updates.pipe(
          Stream.throttle({
            cost: (chunk) => chunk.length,
            units: 1,
            duration: "100 millis",
            strategy: "enforce",
          }),
        );
      }),
    ),
  ),
);

export const eventsSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = get(selectedInstanceAtom);
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
              logValidationFailure(`events archive query (${instance})`, error, {
                instance,
                next,
              }),
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

      const subscriptions = yield* YamcsSubscriptions;
      const initial = [...priorEvents].reverse();

      return Stream.concat(Stream.succeed(initial), subscriptions.events(initial));
    }),
  ),
);
