import { NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";

const logger = Logger.consolePretty({
  colors: true,
  stderr: true,
  mode: "tty",
  formatDate: (date) => date.toLocaleTimeString(undefined),
});

const simulatorLayer = Layer.mergeAll(
  NodeHttpClient.layerUndici,
  Logger.layer([logger]),
);

const simulator = Effect.log("Hello world from ops-simulator").pipe(
  Effect.provide(simulatorLayer),
);

// The simulator is fully provided above; this narrows a beta runtime typing gap.
const runnableSimulator = simulator as Effect.Effect<void, unknown, never>;

NodeRuntime.runMain(runnableSimulator);
