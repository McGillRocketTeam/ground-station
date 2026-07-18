import { Schema } from "effect";

export const OverlayRegion = Schema.Literals(["header", "main", "sidebar", "footer", "banner"]);

export const LayoutAnchor = Schema.Literals([
  "topLeft",
  "topCenter",
  "topRight",
  "centerLeft",
  "center",
  "centerRight",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
]);

export const NoticeSeverity = Schema.Literals(["info", "caution", "offNominal", "abort"]);

export const TelemetryValueStatus = Schema.Literals([
  "nominal",
  "warning",
  "critical",
  "stale",
  "unknown",
]);

export class LayoutPlacement extends Schema.Class<LayoutPlacement>("LayoutPlacement")({
  targetId: Schema.String,
  region: OverlayRegion,
  order: Schema.Int,
  anchor: LayoutAnchor,
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
  visibleByDefault: Schema.Boolean,
  zIndex: Schema.optional(Schema.Int),
}) {}

export class LayoutRecommendation extends Schema.Class<LayoutRecommendation>(
  "LayoutRecommendation",
)({
  placements: Schema.Array(LayoutPlacement),
}) {}
