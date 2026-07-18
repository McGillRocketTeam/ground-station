import { Context, DateTime, Duration, Effect, Layer, SubscriptionRef } from "effect";

import {
  ActiveMilestoneState,
  ActiveNoticeOverlay,
  CountdownControlState,
  CountdownOverlay,
  CustomNoticeState,
  DualStatTelemetryTileDefinition,
  DualStatTelemetryTileOverlay,
  GaugeTelemetryTileDefinition,
  GaugeTelemetryTileOverlay,
  LayoutAnchor,
  LayoutPlacement,
  LayoutRecommendation,
  MediaConfig,
  MediaRuntimeState,
  MilestoneChecklistItemDefinition,
  MilestoneChecklistItemOverlay,
  MilestoneDefinition,
  MilestoneOverlay,
  MissionHeader,
  NoticeSeverity,
  NumberTelemetryFormat,
  OverlayRegion,
  OverlayState,
  PresetNoticeState,
  ResolvedTelemetryValue,
  SingleStatTelemetryTileDefinition,
  SingleStatTelemetryTileOverlay,
  StateTelemetryFormat,
  StatusTelemetryTileDefinition,
  StatusTelemetryTileOverlay,
  TargetVisibilityOverride,
  TelemetryBinding,
  TelemetryTileDefinition,
  TextTelemetryFormat,
  VisibilityState,
} from "./schema/index.ts";

const severityOrder: Record<typeof NoticeSeverity.Type, number> = {
  abort: 4,
  offNominal: 3,
  caution: 2,
  info: 1,
};

const makePlacement = (input: {
  targetId: string;
  region: typeof OverlayRegion.Type;
  anchor: typeof LayoutAnchor.Type;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visibleByDefault?: boolean;
  zIndex?: number;
}) =>
  LayoutPlacement.make({
    ...input,
    visibleByDefault: input.visibleByDefault ?? true,
  });

const defaultConfig = MediaConfig.make({
  mission: MissionHeader.make({
    missionTitle: "Mission Title",
    vehicleName: "Vehicle Name",
  }),
  milestones: [
    MilestoneDefinition.make({
      id: "terminal-count",
      title: "Terminal Count",
      blurb: "Final polling and vehicle configuration are underway ahead of the planned red flag.",
      checklist: [
        MilestoneChecklistItemDefinition.make({
          id: "go-no-go",
          label: "Go / no-go poll complete",
        }),
        MilestoneChecklistItemDefinition.make({
          id: "range-green",
          label: "Range and safety systems green",
        }),
        MilestoneChecklistItemDefinition.make({
          id: "vehicle-armed",
          label: "Vehicle configured for terminal operations",
        }),
      ],
    }),
  ],
  telemetryTiles: [
    SingleStatTelemetryTileDefinition.make({
      id: "altitude",
      label: "Altitude",
      binding: TelemetryBinding.make({
        key: "altitude",
        parameter: "/Vehicle/Altitude",
        fallbackDisplay: "Awaiting data",
        staleAfterMs: 5_000,
      }),
      format: NumberTelemetryFormat.make({ unitLabel: "m", precision: 0 }),
      recommendedPlacement: makePlacement({
        targetId: "altitude",
        region: "sidebar",
        anchor: "topRight",
        order: 0,
        x: 0.82,
        y: 0.12,
        width: 0.16,
        height: 0.08,
      }),
    }),
    DualStatTelemetryTileDefinition.make({
      id: "velocity-acceleration",
      label: "Flight Dynamics",
      primaryBinding: TelemetryBinding.make({
        key: "velocity",
        parameter: "/Vehicle/Velocity",
        fallbackDisplay: "Awaiting data",
      }),
      secondaryBinding: TelemetryBinding.make({
        key: "acceleration",
        parameter: "/Vehicle/Acceleration",
        fallbackDisplay: "Awaiting data",
      }),
      format: NumberTelemetryFormat.make({ unitLabel: "m/s", precision: 1 }),
      secondaryFormat: NumberTelemetryFormat.make({ unitLabel: "m/s^2", precision: 2 }),
      recommendedPlacement: makePlacement({
        targetId: "velocity-acceleration",
        region: "sidebar",
        anchor: "topRight",
        order: 1,
        x: 0.82,
        y: 0.22,
        width: 0.16,
        height: 0.1,
      }),
    }),
    StatusTelemetryTileDefinition.make({
      id: "vehicle-state",
      label: "Vehicle State",
      binding: TelemetryBinding.make({
        key: "vehicleState",
        parameter: "/Vehicle/State",
        fallbackDisplay: "Unknown",
      }),
      format: StateTelemetryFormat.make({
        mappings: [],
        fallbackText: "Unknown",
      }),
      options: [],
      recommendedPlacement: makePlacement({
        targetId: "vehicle-state",
        region: "sidebar",
        anchor: "topRight",
        order: 2,
        x: 0.82,
        y: 0.34,
        width: 0.16,
        height: 0.08,
      }),
    }),
    GaugeTelemetryTileDefinition.make({
      id: "propellant-pressure",
      label: "Tank Pressure",
      binding: TelemetryBinding.make({
        key: "tankPressure",
        parameter: "/Vehicle/TankPressure",
        fallbackDisplay: "Awaiting data",
      }),
      format: NumberTelemetryFormat.make({ unitLabel: "psi", precision: 0 }),
      min: 0,
      max: 5_000,
      thresholds: [],
      recommendedPlacement: makePlacement({
        targetId: "propellant-pressure",
        region: "sidebar",
        anchor: "topRight",
        order: 3,
        x: 0.82,
        y: 0.44,
        width: 0.16,
        height: 0.1,
      }),
    }),
  ],
  defaultLayout: LayoutRecommendation.make({
    placements: [
      makePlacement({
        targetId: "mission-header",
        region: "header",
        anchor: "topLeft",
        order: 0,
        x: 0.04,
        y: 0.04,
        width: 0.24,
        height: 0.1,
      }),
      makePlacement({
        targetId: "countdown",
        region: "header",
        anchor: "topCenter",
        order: 1,
        x: 0.38,
        y: 0.04,
        width: 0.24,
        height: 0.1,
      }),
      makePlacement({
        targetId: "milestone",
        region: "main",
        anchor: "bottomLeft",
        order: 0,
        x: 0.04,
        y: 0.72,
        width: 0.36,
        height: 0.2,
      }),
      makePlacement({
        targetId: "active-notice",
        region: "footer",
        anchor: "bottomCenter",
        order: 0,
        x: 0.16,
        y: 0.92,
        width: 0.68,
        height: 0.06,
      }),
    ],
  }),
});

const makeInitialRuntimeState = (now: DateTime.Utc) =>
  MediaRuntimeState.make({
    countdown: CountdownControlState.make({
      redFlagAt: DateTime.add(now, { minutes: 15 }),
    }),
    activeMilestone: ActiveMilestoneState.make({
      milestoneId: "terminal-count",
      selectedAt: now,
      checklist: [],
    }),
    notices: [
      PresetNoticeState.make({
        id: "nominal-status",
        preset: "nominal-status",
        severity: "info",
        message: "All systems are currently operating nominally.",
        active: true,
        sticky: false,
        createdAt: now,
        dismissedAt: null,
        expiresAt: null,
      }),
      CustomNoticeState.make({
        id: "media-note",
        severity: "caution",
        message: "Use this slot for off-nominal or abort messaging when needed.",
        title: "Operator Notice",
        active: false,
        sticky: true,
        createdAt: now,
        dismissedAt: null,
        expiresAt: null,
      }),
    ],
    visibility: VisibilityState.make({
      targets: [TargetVisibilityOverride.make({ targetId: "active-notice", visible: true })],
      regions: [],
    }),
  });

const resolveDisplayValue = (
  binding: typeof TelemetryBinding.Type,
  format:
    | typeof NumberTelemetryFormat.Type
    | typeof TextTelemetryFormat.Type
    | typeof StateTelemetryFormat.Type,
) => {
  const fallbackDisplay =
    binding.fallbackDisplay ?? ("fallbackText" in format ? format.fallbackText : undefined);
  const unitLabel = "unitLabel" in format ? format.unitLabel : undefined;

  return ResolvedTelemetryValue.make({
    key: binding.key,
    displayValue: fallbackDisplay ?? "Awaiting data",
    rawValueText: undefined,
    unitLabel,
    status: "unknown",
    observedAt: null,
  });
};

const resolveTelemetryTile = (tile: typeof TelemetryTileDefinition.Type) => {
  switch (tile._tag) {
    case "SingleStatTelemetryTileDefinition":
      return SingleStatTelemetryTileOverlay.make({
        id: tile.id,
        label: tile.label,
        recommendedPlacement: tile.recommendedPlacement,
        value: resolveDisplayValue(tile.binding, tile.format),
      });
    case "DualStatTelemetryTileDefinition":
      return DualStatTelemetryTileOverlay.make({
        id: tile.id,
        label: tile.label,
        recommendedPlacement: tile.recommendedPlacement,
        primaryValue: resolveDisplayValue(tile.primaryBinding, tile.format),
        secondaryValue: resolveDisplayValue(
          tile.secondaryBinding,
          tile.secondaryFormat ?? tile.format,
        ),
      });
    case "StatusTelemetryTileDefinition":
      return StatusTelemetryTileOverlay.make({
        id: tile.id,
        label: tile.label,
        recommendedPlacement: tile.recommendedPlacement,
        value: resolveDisplayValue(tile.binding, tile.format),
        statusLabel: tile.format.fallbackText ?? tile.binding.fallbackDisplay ?? "Unknown",
      });
    case "GaugeTelemetryTileDefinition":
      return GaugeTelemetryTileOverlay.make({
        id: tile.id,
        label: tile.label,
        recommendedPlacement: tile.recommendedPlacement,
        value: resolveDisplayValue(tile.binding, tile.format),
        min: tile.min,
        max: tile.max,
        percentage: 0,
      });
  }
};

const resolveMilestone = (
  milestones: ReadonlyArray<typeof MilestoneDefinition.Type>,
  activeMilestone: typeof ActiveMilestoneState.Type | null,
) => {
  if (activeMilestone === null) {
    return null;
  }

  const milestone = milestones.find((candidate) => candidate.id === activeMilestone.milestoneId);

  if (milestone === undefined) {
    return null;
  }

  const checklistStateById = new Map(
    activeMilestone.checklist.map((entry) => [entry.itemId, entry.checked]),
  );

  return MilestoneOverlay.make({
    id: milestone.id,
    title: milestone.title,
    blurb: activeMilestone.blurbOverride ?? milestone.blurb,
    checklist: milestone.checklist.map((item) =>
      MilestoneChecklistItemOverlay.make({
        id: item.id,
        label: item.label,
        checked: checklistStateById.get(item.id) ?? false,
      }),
    ),
  });
};

const resolveActiveNotice = (
  notices: ReadonlyArray<typeof PresetNoticeState.Type | typeof CustomNoticeState.Type>,
) => {
  const activeNotices = notices.filter((notice) => notice.active);

  if (activeNotices.length === 0) {
    return null;
  }

  const activeNotice = [...activeNotices].sort(
    (left, right) => severityOrder[right.severity] - severityOrder[left.severity],
  )[0]!;

  return ActiveNoticeOverlay.make({
    id: activeNotice.id,
    severity: activeNotice.severity,
    message: activeNotice.message,
    title: activeNotice._tag === "CustomNoticeState" ? activeNotice.title : activeNotice.preset,
    sticky: activeNotice.sticky,
    createdAt: activeNotice.createdAt,
    expiresAt: activeNotice.expiresAt,
  });
};

const resolveCountdown = (redFlagAt: DateTime.Utc | null, now: DateTime.Utc) => {
  if (redFlagAt === null) {
    return CountdownOverlay.make({
      redFlagAt: null,
      tMinusMs: null,
      label: "Awaiting red flag",
    });
  }

  const tMinusMs = Duration.toMillis(DateTime.distance(now, redFlagAt));

  return CountdownOverlay.make({
    redFlagAt,
    tMinusMs,
    label: tMinusMs >= 0 ? "T-" : "T+",
  });
};

const buildOverlayState = (
  config: typeof MediaConfig.Type,
  runtime: typeof MediaRuntimeState.Type,
  now: DateTime.Utc,
) =>
  OverlayState.make({
    mission: config.mission,
    countdown: resolveCountdown(runtime.countdown.redFlagAt, now),
    milestone: resolveMilestone(config.milestones, runtime.activeMilestone),
    telemetry: config.telemetryTiles.map(resolveTelemetryTile),
    activeNotice: resolveActiveNotice(runtime.notices),
    layout: config.defaultLayout,
    generatedAt: now,
  });

export class OverlayStateStore extends Context.Service<
  OverlayStateStore,
  {
    readonly get: Effect.Effect<typeof OverlayState.Type>;
  }
>()("@mrt/media-backend/OverlayStateStore") {
  static readonly layer = Layer.effect(
    OverlayStateStore,
    Effect.gen(function* () {
      const now = yield* DateTime.now;
      const runtimeState = yield* SubscriptionRef.make(makeInitialRuntimeState(now));
      const config = defaultConfig;

      const get = Effect.gen(function* () {
        const currentRuntime = yield* SubscriptionRef.get(runtimeState);
        const generatedAt = yield* DateTime.now;

        return buildOverlayState(config, currentRuntime, generatedAt);
      });

      return OverlayStateStore.of({
        get,
      });
    }),
  );
}
