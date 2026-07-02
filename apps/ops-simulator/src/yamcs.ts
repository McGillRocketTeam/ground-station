import { YamcsApi } from "@mrt/yamcs-effect";
import { Config, Context, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

export type YamcsClient = HttpApiClient.ForApi<typeof YamcsApi>;

export interface YamcsProcessorTarget {
  readonly instance: string;
  readonly processor: string;
}

export const YamcsClient = Context.Service<YamcsClient>("@mrt/ops-simulator/YamcsClient");

export const loadYamcsProcessorTarget = Effect.gen(function* () {
  const instance = yield* Config.string("YAMCS_INSTANCE").pipe(
    Config.withDefault("launch-canada-sim"),
  );
  const processor = yield* Config.string("YAMCS_PROCESSOR").pipe(Config.withDefault("realtime"));

  return {
    instance,
    processor,
  } satisfies YamcsProcessorTarget;
});

export const YamcsClientLive = Layer.effect(
  YamcsClient,
  Effect.gen(function* () {
    const yamcsUrl = yield* Config.string("YAMCS_BASE_URL").pipe(
      Config.withDefault("http://localhost:8090"),
    );

    return yield* HttpApiClient.make(YamcsApi, {
      transformClient: (client) =>
        HttpClient.mapRequest(client, (req) =>
          HttpClientRequest.setUrl(
            req,
            new URL(req.url.replaceAll("%3A", ":"), yamcsUrl).toString(),
          ),
        ),
    });
  }),
);
