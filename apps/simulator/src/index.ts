import { Effect, Logger } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { RadioSimulator } from "./devices/radio.ts";
import { MqttConnection } from "./utils/MqttConnection.ts";
import { FlightComputerSimulator } from "./devices/flight-computer.ts";

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
      RadioSimulator("SystemA/Pad/Radio"),
      FlightComputerSimulator("SystemA/Rocket/FlightComputer"),

      RadioSimulator("SystemB/ControlStation/Radio"),
      RadioSimulator("SystemB/Pad/Radio"),
      FlightComputerSimulator("SystemB/Rocket/FlightComputer"),
    ],
    { concurrency: "unbounded" },
  );
}).pipe(
  Effect.provide(MqttConnection.layer),
  Effect.provide(Logger.layer([logger])),
  Effect.catch((e) => Effect.logError(e)),
);

NodeRuntime.runMain(simulator);
