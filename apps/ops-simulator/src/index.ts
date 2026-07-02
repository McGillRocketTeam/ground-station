import { NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger, Schedule } from "effect";

import { readParameters, makeInitialState, setValve, stepSimulation } from "./simulator.ts";
import { buildN20FillSystem } from "./topology.ts";
import { loadYamcsProcessorTarget, YamcsClient, YamcsClientLive } from "./yamcs.ts";

const simulatorLayer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty({ colors: true })]),
  YamcsClientLive.pipe(Layer.provideMerge(NodeHttpClient.layerUndici)),
);

const runDemo = Effect.gen(function* () {
  const yamcs = yield* YamcsClient;
  const target = yield* loadYamcsProcessorTarget;
  yield* Effect.log("Initialized YamcsApi HTTP client");

  const system = buildN20FillSystem();

  let state = makeInitialState(system);
  // state = setValve(state, "V-22", 1);

  let tick = 1;

  const step = Effect.gen(function* () {
    state = stepSimulation(system, state, 1);
    const request = readParameters(system, state);

    yield* yamcs.parameter
      .batchSetParameterValues({
        params: target,
        payload: { request },
      })
      .pipe(
        Effect.catchReason("HttpClientError", "DecodeError", (e) =>
          e.response.json.pipe(Effect.flatMap(Effect.logError)),
        ),
      );

    yield* Effect.log({
      tick,
      request: request.map(
        (a) => `${a.id.name}: ${"value" in a.value ? a.value.value : undefined}`,
      ),
    });
    tick++;
  });

  yield* step.pipe(Effect.repeat(Schedule.spaced("1 seconds")), Effect.forkScoped);

  return yield* Effect.never;
}).pipe(Effect.provide(simulatorLayer), Effect.scoped);

NodeRuntime.runMain(runDemo);
