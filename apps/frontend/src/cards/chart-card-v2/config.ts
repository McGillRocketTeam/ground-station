import { Schema } from "effect";

export const ChartSeriesKeySchema = Schema.Literals(["x", "y"]);

export const ChartSeriesConfigSchema = Schema.Struct({
  color: Schema.String,
  key: ChartSeriesKeySchema,
  label: Schema.String,
  parameter: Schema.String,
});

export const ChartCardV2ConfigSchema = Schema.Struct({
  series: Schema.optional(Schema.Array(ChartSeriesConfigSchema)),
});

export type ChartSeriesKey = typeof ChartSeriesKeySchema.Type;
export type ChartSeriesConfig = typeof ChartSeriesConfigSchema.Type;
export type ChartCardV2Config = typeof ChartCardV2ConfigSchema.Type;

export const DEFAULT_SERIES_CONFIGS: ReadonlyArray<ChartSeriesConfig> = [
  {
    color: "#2563eb",
    key: "x",
    label: "Acceleration X",
    parameter: "/SystemA/Rocket/FlightComputer/acceleration_x",
  },
  {
    color: "#f97316",
    key: "y",
    label: "Acceleration Y",
    parameter: "/SystemA/Rocket/FlightComputer/acceleration_y",
  },
];
