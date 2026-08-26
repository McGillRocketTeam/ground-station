import { Schema } from "effect";

import { NoticeSeverity, OverlayRegion } from "./shared.ts";

export class CountdownControlState extends Schema.Class<CountdownControlState>(
  "CountdownControlState",
)({
  redFlagAt: Schema.NullOr(Schema.DateTimeUtcFromString),
}) {}

export class SetRedFlagPayload extends Schema.Class<SetRedFlagPayload>("SetRedFlagPayload")({
  redFlagAt: Schema.DateTimeUtcFromString,
}) {}

export class MilestoneChecklistItemState extends Schema.Class<MilestoneChecklistItemState>(
  "MilestoneChecklistItemState",
)({
  itemId: Schema.String,
  checked: Schema.Boolean,
  checkedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
}) {}

export class ActiveMilestoneState extends Schema.Class<ActiveMilestoneState>(
  "ActiveMilestoneState",
)({
  milestoneId: Schema.String,
  selectedAt: Schema.DateTimeUtcFromString,
  blurbOverride: Schema.optional(Schema.String),
  checklist: Schema.Array(MilestoneChecklistItemState),
}) {}

const NoticeBaseFields = {
  id: Schema.String,
  severity: NoticeSeverity,
  message: Schema.String,
  active: Schema.Boolean,
  sticky: Schema.Boolean,
  createdAt: Schema.DateTimeUtcFromString,
  dismissedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromString),
} as const;

export class PresetNoticeState extends Schema.TaggedClass<PresetNoticeState>()(
  "PresetNoticeState",
  {
    ...NoticeBaseFields,
    preset: Schema.String,
  },
) {}

export class CustomNoticeState extends Schema.TaggedClass<CustomNoticeState>()(
  "CustomNoticeState",
  {
    ...NoticeBaseFields,
    title: Schema.optional(Schema.String),
  },
) {}

export const NoticeState = Schema.Union([PresetNoticeState, CustomNoticeState]);

export class TargetVisibilityOverride extends Schema.Class<TargetVisibilityOverride>(
  "TargetVisibilityOverride",
)({
  targetId: Schema.String,
  visible: Schema.Boolean,
}) {}

export class RegionVisibilityOverride extends Schema.Class<RegionVisibilityOverride>(
  "RegionVisibilityOverride",
)({
  region: OverlayRegion,
  visible: Schema.Boolean,
}) {}

export class VisibilityState extends Schema.Class<VisibilityState>("VisibilityState")({
  targets: Schema.Array(TargetVisibilityOverride),
  regions: Schema.Array(RegionVisibilityOverride),
}) {}

export class MediaRuntimeState extends Schema.Class<MediaRuntimeState>("MediaRuntimeState")({
  countdown: CountdownControlState,
  activeMilestone: Schema.NullOr(ActiveMilestoneState),
  notices: Schema.Array(NoticeState),
  visibility: VisibilityState,
}) {}
