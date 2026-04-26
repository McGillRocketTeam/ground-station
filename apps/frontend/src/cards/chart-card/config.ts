import { Schema } from "effect";

import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";

export const ChartSeriesConfigSchema = Schema.Struct({
  color: Schema.String.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Color" }),
  ),
  label: Schema.String.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Label" }),
  ),
  parameter: Schema.String.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Parameter" }),
  ),
});

export const ChartCardConfigSchema = Schema.Struct({
  series: Schema.optional(Schema.Array(ChartSeriesConfigSchema)).pipe(
    Schema.annotate({
      [FormTitleAnnotationId]: "Series",
      [FormTypeAnnotationId]: "chartSeries",
    }),
  ),
});

export type ChartSeriesConfig = typeof ChartSeriesConfigSchema.Type;
export type ChartCardConfig = typeof ChartCardConfigSchema.Type;

export const DEFAULT_SERIES_CONFIGS: ReadonlyArray<ChartSeriesConfig> = [
  {
    color: "#2563eb",
    label: "Acceleration X",
    parameter: "/SystemA/Rocket/FlightComputer/acceleration_x",
  },
  {
    color: "#f97316",
    label: "Acceleration Y",
    parameter: "/SystemA/Rocket/FlightComputer/acceleration_y",
  },
];
