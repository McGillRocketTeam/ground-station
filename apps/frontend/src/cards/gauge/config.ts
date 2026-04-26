import { Schema } from "effect";

import { ParameterField } from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId } from "@/lib/form";

export const GaugeVisualRangePatternSchema = Schema.Literals([
  "success",
  "success-chevron",
  "yellow",
  "yellow-chevron",
  "red",
  "red-chevron",
]);

export const GaugeVisualRangeSchema = Schema.Struct({
  end: Schema.NumberFromString.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Range End" }),
  ),
  pattern: GaugeVisualRangePatternSchema.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Range Pattern" }),
  ),
  start: Schema.NumberFromString.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Range Start" }),
  ),
});

export const GaugeCardConfigSchema = Schema.Struct({
  label: Schema.optional(Schema.String).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Label" }),
  ),
  max: Schema.optional(Schema.NumberFromString).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Maximum Value" }),
  ),
  min: Schema.optional(Schema.NumberFromString).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Minimum Value" }),
  ),
  parameter: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Gauge Parameter" }),
  ),
  ranges: Schema.optional(Schema.Array(GaugeVisualRangeSchema)).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Visual Ranges" }),
  ),
});

export type GaugeVisualRange = typeof GaugeVisualRangeSchema.Type;
export type GaugeVisualRangePattern = typeof GaugeVisualRangePatternSchema.Type;
export type GaugeCardConfig = typeof GaugeCardConfigSchema.Type;

export const DEFAULT_VISUAL_RANGES: ReadonlyArray<GaugeVisualRange> = [
  { pattern: "red-chevron", start: -32, end: -24 },
  { pattern: "red-chevron", start: 24, end: 32 },
];

export const DEFAULT_GAUGE_PARAMETER =
  "/SystemA/Rocket/FlightComputer/acceleration_x";
