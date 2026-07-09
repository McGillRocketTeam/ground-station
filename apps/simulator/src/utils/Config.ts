import { Config, Schema } from "effect";

export const BROKER_URL = Config.nonEmptyString("BROKER_URL").pipe(
  Config.withDefault("mqtt://localhost:1883"),
);

export const YAMCS_URL = Config.nonEmptyString("YAMCS_URL").pipe(
  Config.withDefault("http://localhost:8090"),
);

export const YAMCS_INSTANCE = Config.nonEmptyString("YAMCS_INSTANCE").pipe(
  Config.withDefault("launch-canada"),
);

export const DATA_MODE = Config.schema(
  Schema.Literals(["random", "incremental"]),
  "DATA_MODE",
).pipe(Config.withDefault("incremental"));

export const SIMULATOR_SYSTEM = Config.nonEmptyString("SIMULATOR_SYSTEM").pipe(
  Config.withDefault("SystemA"),
);

export const SIMULATOR_RADIO_LOCATION = Config.schema(
  Schema.Literals(["Pad", "ControlStation"]),
  "SIMULATOR_RADIO_LOCATION",
).pipe(Config.withDefault("ControlStation"));

export const SIMULATOR_TELEMETRY_INTERVAL_MS = Config.schema(
  Schema.NumberFromString,
  "SIMULATOR_TELEMETRY_INTERVAL_MS",
).pipe(Config.withDefault(100));

export const SIMULATOR_STATE_INTERVAL_MS = Config.schema(
  Schema.NumberFromString,
  "SIMULATOR_STATE_INTERVAL_MS",
).pipe(Config.withDefault(1000));
