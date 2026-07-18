import { Schema } from "effect";

import { MissionHeader } from "./config.ts";
import {
  LayoutPlacement,
  LayoutRecommendation,
  NoticeSeverity,
  TelemetryValueStatus,
} from "./shared.ts";

export class CountdownOverlay extends Schema.Class<CountdownOverlay>("CountdownOverlay")({
  redFlagAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  tMinusMs: Schema.NullOr(Schema.Number),
  label: Schema.String,
}) {}

export class MilestoneChecklistItemOverlay extends Schema.Class<MilestoneChecklistItemOverlay>(
  "MilestoneChecklistItemOverlay",
)({
  id: Schema.String,
  label: Schema.String,
  checked: Schema.Boolean,
}) {}

export class MilestoneOverlay extends Schema.Class<MilestoneOverlay>("MilestoneOverlay")({
  id: Schema.String,
  title: Schema.String,
  blurb: Schema.String,
  checklist: Schema.Array(MilestoneChecklistItemOverlay),
}) {}

export class ResolvedTelemetryValue extends Schema.Class<ResolvedTelemetryValue>(
  "ResolvedTelemetryValue",
)({
  key: Schema.String,
  displayValue: Schema.String,
  rawValueText: Schema.optional(Schema.String),
  unitLabel: Schema.optional(Schema.String),
  status: TelemetryValueStatus,
  observedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
}) {}

const TelemetryTileOverlayBaseFields = {
  id: Schema.String,
  label: Schema.String,
  recommendedPlacement: Schema.optional(LayoutPlacement),
} as const;

export class SingleStatTelemetryTileOverlay extends Schema.TaggedClass<SingleStatTelemetryTileOverlay>()(
  "SingleStatTelemetryTileOverlay",
  {
    ...TelemetryTileOverlayBaseFields,
    value: ResolvedTelemetryValue,
  },
) {}

export class DualStatTelemetryTileOverlay extends Schema.TaggedClass<DualStatTelemetryTileOverlay>()(
  "DualStatTelemetryTileOverlay",
  {
    ...TelemetryTileOverlayBaseFields,
    primaryValue: ResolvedTelemetryValue,
    secondaryValue: ResolvedTelemetryValue,
  },
) {}

export class StatusTelemetryTileOverlay extends Schema.TaggedClass<StatusTelemetryTileOverlay>()(
  "StatusTelemetryTileOverlay",
  {
    ...TelemetryTileOverlayBaseFields,
    value: ResolvedTelemetryValue,
    statusLabel: Schema.String,
  },
) {}

export class GaugeTelemetryTileOverlay extends Schema.TaggedClass<GaugeTelemetryTileOverlay>()(
  "GaugeTelemetryTileOverlay",
  {
    ...TelemetryTileOverlayBaseFields,
    value: ResolvedTelemetryValue,
    min: Schema.Number,
    max: Schema.Number,
    percentage: Schema.Number,
  },
) {}

export const TelemetryTileOverlay = Schema.Union([
  SingleStatTelemetryTileOverlay,
  DualStatTelemetryTileOverlay,
  StatusTelemetryTileOverlay,
  GaugeTelemetryTileOverlay,
]);

export class ActiveNoticeOverlay extends Schema.Class<ActiveNoticeOverlay>("ActiveNoticeOverlay")({
  id: Schema.String,
  severity: NoticeSeverity,
  message: Schema.String,
  title: Schema.optional(Schema.String),
  sticky: Schema.Boolean,
  createdAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromString),
}) {}

export class OverlayState extends Schema.Class<OverlayState>("OverlayState")({
  mission: MissionHeader,
  countdown: CountdownOverlay,
  milestone: Schema.NullOr(MilestoneOverlay),
  telemetry: Schema.Array(TelemetryTileOverlay),
  activeNotice: Schema.NullOr(ActiveNoticeOverlay),
  layout: LayoutRecommendation,
  generatedAt: Schema.DateTimeUtcFromString,
}) {}
