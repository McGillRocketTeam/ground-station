import { YamcsApi, YamcsConfig } from "@mrt/yamcs-effect";
import { Config, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

export interface YamcsProcessorTarget {
  readonly instance: string;
  readonly processor: string;
}

const INSTANCE = Config.string("YAMCS_INSTANCE").pipe(Config.withDefault("launch-canada-sim"));

export const loadYamcsProcessorTarget = Effect.gen(function* () {
  const instance = yield* INSTANCE;
  const processor = yield* Config.string("YAMCS_PROCESSOR").pipe(Config.withDefault("realtime"));

  return {
    instance,
    processor,
  } satisfies YamcsProcessorTarget;
});

export const yamcsConfigLayer = Layer.effect(
  YamcsConfig,
  Effect.gen(function* () {
    const instance = yield* INSTANCE;
    return {
      url: new URL("http://localhost:8090"),
      instance,
      processor: "realtime",
    };
  }),
);

export const makeYamcsClient = Effect.gen(function* () {
  const yamcsUrl = yield* Config.string("YAMCS_BASE_URL").pipe(
    Config.withDefault("http://localhost:8090"),
  );

  return yield* HttpApiClient.make(YamcsApi, {
    transformClient: (client) =>
      HttpClient.mapRequest(client, (req) =>
        HttpClientRequest.setUrl(req, new URL(req.url.replaceAll("%3A", ":"), yamcsUrl).toString()),
      ),
  });
});
