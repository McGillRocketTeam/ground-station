import { Config, Schema } from "effect";

export const BROKER_URL = Config.nonEmptyString("BROKER_URL").pipe(
  Config.withDefault(() => "mqtt://localhost:1883"),
);

export const YAMCS_URL = Config.nonEmptyString("YAMCS_URL").pipe(
  Config.withDefault(() => "http://localhost:8090"),
);

export const YAMCS_INSTANCE = Config.nonEmptyString("YAMCS_URL").pipe(
  Config.withDefault(() => "urrg"),
);

export const DATA_MODE = Config.schema(
  Schema.Literals(["random", "sequential"]),
).pipe(Config.withDefault(() => "sequential"));
