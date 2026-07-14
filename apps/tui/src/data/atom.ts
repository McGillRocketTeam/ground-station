import {
  ParameterEvent,
  ParameterValue,
  SubscribeParameterRequest,
  WebSocketClient,
  YamcsApi,
} from "@mrt/yamcs-effect";
import { ConfigProvider, Effect, Layer, Schedule, Schema, Stream, Tracer } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { Atom, AtomHttpApi } from "effect/unstable/reactivity";

export const YAMCS_INSTANCE = "launch-canada";
const YAMCS_URL = "http://localhost:8090";

const tuiRuntimeFactory = Atom.context({ memoMap: Atom.defaultMemoMap });
tuiRuntimeFactory.addGlobalLayer(
  ConfigProvider.layer(ConfigProvider.fromUnknown({ YAMCS_URL })),
);

const subscriptionRuntime = tuiRuntimeFactory(WebSocketClient.layer);

export class YamcsAtomHttpClient extends AtomHttpApi.Service<YamcsAtomHttpClient>()(
  "@mrt/frontend/YamcsAtomHttpClient",
  {
    api: YamcsApi,
    httpClient: FetchHttpClient.layer as Layer.Layer<unknown>,
    transformClient: (client) =>
      client.pipe(
        HttpClient.transformResponse((effect) =>
          Effect.provideService(effect, Tracer.DisablePropagation, true),
        ),
        HttpClient.mapRequest((req) =>
          HttpClientRequest.setUrl(
            new URL(
              req.url.replaceAll("%3A", ":"),
              YAMCS_URL,
            ).toString(),
          )(req),
        ),
        HttpClient.retryTransient({
          times: 3,
          schedule: Schedule.exponential("500 millis", 2),
        }),
      ),
  },
) {}

export const parameterSubscriptionAtom = Atom.family((qualifiedName: string) =>
  subscriptionRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const ws = yield* WebSocketClient;
        const { call, stream } = yield* ws.subscribe(
          SubscribeParameterRequest.make({
            instance: YAMCS_INSTANCE,
            processor: "realtime",
            id: [{ name: qualifiedName }],
          }),
        );

        const eventStream = stream.pipe(
          Stream.mapEffect((message) =>
            Schema.decodeUnknownEffect(ParameterEvent)(message.data),
          ),
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
