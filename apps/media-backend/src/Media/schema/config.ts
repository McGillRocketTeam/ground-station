import { Schema } from "effect";

import { LayoutPlacement, LayoutRecommendation, TelemetryValueStatus } from "./shared.ts";

export class MissionHeader extends Schema.Class<MissionHeader>("MissionHeader")({
  missionTitle: Schema.String,
  vehicleName: Schema.String,
}) {}

export class MilestoneChecklistItemDefinition extends Schema.Class<MilestoneChecklistItemDefinition>(
  "MilestoneChecklistItemDefinition",
)({
  id: Schema.String,
  label: Schema.String,
}) {}

export class MilestoneDefinition extends Schema.Class<MilestoneDefinition>("MilestoneDefinition")({
  id: Schema.String,
  title: Schema.String,
  blurb: Schema.String,
  checklist: Schema.Array(MilestoneChecklistItemDefinition),
}) {}

export class TelemetryBinding extends Schema.Class<TelemetryBinding>("TelemetryBinding")({
  key: Schema.String,
  parameter: Schema.String,
  staleAfterMs: Schema.optional(Schema.Int),
  fallbackDisplay: Schema.optional(Schema.String),
}) {}

export class NumberTelemetryFormat extends Schema.TaggedClass<NumberTelemetryFormat>()(
  "NumberTelemetryFormat",
  {
    precision: Schema.optional(Schema.Int),
    unitLabel: Schema.optional(Schema.String),
    prefix: Schema.optional(Schema.String),
    suffix: Schema.optional(Schema.String),
  },
) {}

export class TextTelemetryFormat extends Schema.TaggedClass<TextTelemetryFormat>()(
  "TextTelemetryFormat",
  {
    fallbackText: Schema.optional(Schema.String),
  },
) {}

export class StateLabelMapping extends Schema.Class<StateLabelMapping>("StateLabelMapping")({
  input: Schema.String,
  outputLabel: Schema.String,
  status: Schema.optional(TelemetryValueStatus),
}) {}

export class StateTelemetryFormat extends Schema.TaggedClass<StateTelemetryFormat>()(
  "StateTelemetryFormat",
  {
    mappings: Schema.Array(StateLabelMapping),
    fallbackText: Schema.optional(Schema.String),
  },
) {}

export const TelemetryFormat = Schema.Union([
  NumberTelemetryFormat,
  TextTelemetryFormat,
  StateTelemetryFormat,
]);

const TelemetryTileBaseFields = {
  id: Schema.String,
  label: Schema.String,
  recommendedPlacement: Schema.optional(LayoutPlacement),
} as const;

export class SingleStatTelemetryTileDefinition extends Schema.TaggedClass<SingleStatTelemetryTileDefinition>()(
  "SingleStatTelemetryTileDefinition",
  {
    ...TelemetryTileBaseFields,
    binding: TelemetryBinding,
    format: TelemetryFormat,
  },
) {}

export class DualStatTelemetryTileDefinition extends Schema.TaggedClass<DualStatTelemetryTileDefinition>()(
  "DualStatTelemetryTileDefinition",
  {
    ...TelemetryTileBaseFields,
    primaryBinding: TelemetryBinding,
    secondaryBinding: TelemetryBinding,
    format: TelemetryFormat,
    secondaryFormat: Schema.optional(TelemetryFormat),
  },
) {}

export class StatusOption extends Schema.Class<StatusOption>("StatusOption")({
  label: Schema.String,
  status: TelemetryValueStatus,
}) {}

export class StatusTelemetryTileDefinition extends Schema.TaggedClass<StatusTelemetryTileDefinition>()(
  "StatusTelemetryTileDefinition",
  {
    ...TelemetryTileBaseFields,
    binding: TelemetryBinding,
    format: StateTelemetryFormat,
    options: Schema.Array(StatusOption),
  },
) {}

export class GaugeThreshold extends Schema.Class<GaugeThreshold>("GaugeThreshold")({
  gte: Schema.Number,
  label: Schema.String,
  status: TelemetryValueStatus,
}) {}

export class GaugeTelemetryTileDefinition extends Schema.TaggedClass<GaugeTelemetryTileDefinition>()(
  "GaugeTelemetryTileDefinition",
  {
    ...TelemetryTileBaseFields,
    binding: TelemetryBinding,
    format: NumberTelemetryFormat,
    min: Schema.Number,
    max: Schema.Number,
    thresholds: Schema.Array(GaugeThreshold),
  },
) {}

export const TelemetryTileDefinition = Schema.Union([
  SingleStatTelemetryTileDefinition,
  DualStatTelemetryTileDefinition,
  StatusTelemetryTileDefinition,
  GaugeTelemetryTileDefinition,
]);

export class MediaConfig extends Schema.Class<MediaConfig>("MediaConfig")({
  mission: MissionHeader,
  milestones: Schema.Array(MilestoneDefinition),
  telemetryTiles: Schema.Array(TelemetryTileDefinition),
  defaultLayout: LayoutRecommendation,
}) {}
