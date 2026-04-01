import { NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";

import { makeSimulatorForInstance } from "./systems.ts";
import { YAMCS_INSTANCE } from "./utils/Config.ts";
import { DataGenerator } from "./utils/DataGenerator.ts";
import { MqttConnection } from "./utils/MqttConnection.ts";

const logger = Logger.consolePretty({
  colors: true,
  stderr: true,
  mode: "tty",
  formatDate: (date) => date.toLocaleTimeString(undefined),
});

const simulatorLayer = Layer.mergeAll(
  MqttConnection.layer,
  DataGenerator.layer,
  NodeHttpClient.layerUndici,
  Logger.layer([logger]),
);

const simulator = Effect.gen(function* () {
  const instance = yield* YAMCS_INSTANCE;
  yield* makeSimulatorForInstance(instance);
}).pipe(
  Effect.catch((e) => Effect.logError(e.message)),
  Effect.provide(simulatorLayer),
  Effect.scoped,
);

NodeRuntime.runMain(simulator);
