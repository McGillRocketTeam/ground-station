import { NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { Effect, Logger } from "effect";

import { FlightComputerSimulator } from "./devices/flight-computer.ts";
import { RadioSimulator } from "./devices/radio.ts";
import { DataGenerator } from "./utils/DataGenerator.ts";
import { MqttConnection } from "./utils/MqttConnection.ts";

const logger = Logger.consolePretty({
  colors: true,
  stderr: false,
  mode: "tty",
  formatDate: (date) => date.toLocaleTimeString(undefined),
});

const simulator = Effect.gen(function* () {
  yield* Effect.all(
    [
      RadioSimulator("SystemA/ControlStation/Radio"),
      FlightComputerSimulator("SystemA/Rocket/FlightComputer"),

      RadioSimulator("SystemB/ControlStation/Radio"),
      FlightComputerSimulator("SystemB/Rocket/FlightComputer"),
    ],
    { concurrency: "unbounded" },
  );
}).pipe(
  Effect.provide(MqttConnection.layer),
  Effect.provide(DataGenerator.layer),
  Effect.provide(NodeHttpClient.layerUndici),
  Effect.catch((e) => Effect.logError(e.message)),
  Effect.provide(Logger.layer([logger])),
  Effect.scoped,
);

NodeRuntime.runMain(simulator);
