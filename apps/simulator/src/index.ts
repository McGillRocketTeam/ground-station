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
  yield* Effect.addFinalizer(() => Effect.log("EXIT"));
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
  Effect.scoped,
);

NodeRuntime.runMain(simulator, {
  teardown: function customTeardown(exit, onExit) {
    if (exit._tag === "Failure") {
      console.error("Program ended with an error.");
      onExit(1);
    } else {
      console.log("Program finished successfully.");
      onExit(0);
    }
  },
});
