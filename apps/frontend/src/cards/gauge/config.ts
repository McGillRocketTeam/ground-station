import { Schema } from "effect";

export const GaugeVisualRangePatternSchema = Schema.Literals([
  "success",
  "success-chevron",
  "yellow",
  "yellow-chevron",
  "red",
  "red-chevron",
]);

export const GaugeVisualRangeSchema = Schema.Struct({
  end: Schema.Number,
  pattern: GaugeVisualRangePatternSchema,
  start: Schema.Number,
});

export const GaugeCardConfigSchema = Schema.Struct({
  label: Schema.optional(Schema.String),
  max: Schema.optional(Schema.Number),
  min: Schema.optional(Schema.Number),
  ranges: Schema.optional(Schema.Array(GaugeVisualRangeSchema)),
});

export type GaugeVisualRange = typeof GaugeVisualRangeSchema.Type;
export type GaugeVisualRangePattern = typeof GaugeVisualRangePatternSchema.Type;
export type GaugeCardConfig = typeof GaugeCardConfigSchema.Type;

export const DEFAULT_VISUAL_RANGES: ReadonlyArray<GaugeVisualRange> = [
  { pattern: "yellow", start: 70, end: 90 },
  { pattern: "red-chevron", start: 90, end: 100 },
];
