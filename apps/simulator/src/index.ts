import { NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { Effect, Logger } from "effect";

import { FlightComputerSimulator } from "./devices/flight-computer.ts";
import { RadioSimulator } from "./devices/radio.ts";
import { YAMCS_INSTANCE } from "./utils/Config.ts";
import { DataGenerator } from "./utils/DataGenerator.ts";
import { MqttConnection } from "./utils/MqttConnection.ts";

const logger = Logger.consolePretty({
  colors: true,
  stderr: true,
  mode: "tty",
  formatDate: (date) => date.toLocaleTimeString(undefined),
});

const urrgDevices = [
  RadioSimulator("SystemA/ControlStation/Radio"),
  FlightComputerSimulator("SystemA/Rocket/FlightComputer"),

  RadioSimulator("SystemB/ControlStation/Radio"),
  FlightComputerSimulator("SystemB/Rocket/FlightComputer"),
];

const launchCanadaDevices = [
  RadioSimulator("SystemA/ControlStation/Radio"),
  RadioSimulator("SystemA/Pad/Radio"),
  FlightComputerSimulator("SystemA/Rocket/FlightComputer"),

  RadioSimulator("SystemB/ControlStation/Radio"),
  RadioSimulator("SystemB/Pad/Radio"),
  FlightComputerSimulator("SystemB/Rocket/FlightComputer"),
];

const getDevices = Effect.gen(function* () {
  const instance = yield* YAMCS_INSTANCE;
  switch (instance) {
    case "launch-canada":
      return launchCanadaDevices;
    default:
      return urrgDevices;
  }
});

const simulator = Effect.gen(function* () {
  const devices = yield* getDevices;
  yield* Effect.all(devices, { concurrency: "unbounded" });
}).pipe(
  Effect.provide(MqttConnection.layer),
  Effect.provide(DataGenerator.layer),
  Effect.provide(NodeHttpClient.layerUndici),
  Effect.catch((e) => Effect.logError(e.message)),
  Effect.provide(Logger.layer([logger])),
  Effect.scoped,
);

NodeRuntime.runMain(simulator);
