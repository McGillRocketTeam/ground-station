import { useAtomSuspense } from "@effect/atom-react";
import { Suspense } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterSubscriptionAtom } from "@/lib/atom";

const satelliteSlots = Array.from({ length: 8 }, (_, index) => index + 1);
const satelliteParameterRoot = "/SystemA/Rocket/FlightComputer";

const gnssColors: Record<string, string> = {
  GPS: "#3b82f6",
  SBAS: "#06b6d4",
  Galileo: "#22c55e",
  BeiDou: "#f97316",
  QZSS: "#ec4899",
  GLONASS: "#ef4444",
  NavIC: "#a855f7",
  UNDEF: "#94a3b8",
};

export interface SatelliteTelemetry {
  readonly slot: number;
  readonly azimuth: number | undefined;
  readonly elevation: number | undefined;
  readonly cno: number | undefined;
  readonly satelliteId: number | undefined;
  readonly gnssId: string | undefined;
  readonly usedInFix: boolean;
}

export function satelliteGnssColor(gnssId: string | undefined) {
  return gnssColors[gnssId ?? "UNDEF"] ?? gnssColors.UNDEF;
}

function numericValue(update: LiveParameterUpdate) {
  const value = update.value.engValue;

  switch (value.type) {
    case "FLOAT":
    case "DOUBLE":
    case "SINT32":
    case "UINT32":
    case "SINT64":
    case "UINT64":
      return value.value;
    default:
      return undefined;
  }
}

export function useSatelliteTelemetry(slot: number): SatelliteTelemetry {
  const parameter = (name: string) => `${satelliteParameterRoot}/gps_satellite_${slot}_${name}`;
  const azimuth = numericValue(
    useAtomSuspense(parameterSubscriptionAtom(parameter("azimuth"))).value as LiveParameterUpdate,
  );
  const elevation = numericValue(
    useAtomSuspense(parameterSubscriptionAtom(parameter("elevation"))).value as LiveParameterUpdate,
  );
  const cno = numericValue(
    useAtomSuspense(parameterSubscriptionAtom(parameter("cno"))).value as LiveParameterUpdate,
  );
  const satelliteId = numericValue(
    useAtomSuspense(parameterSubscriptionAtom(parameter("sv_id"))).value as LiveParameterUpdate,
  );
  const gnssValue = (
    useAtomSuspense(parameterSubscriptionAtom(parameter("gnss_id"))).value as LiveParameterUpdate
  ).value.engValue;
  const usedValue = (
    useAtomSuspense(parameterSubscriptionAtom(parameter("used_in_fix")))
      .value as LiveParameterUpdate
  ).value.engValue;

  return {
    slot,
    azimuth,
    elevation,
    cno,
    satelliteId,
    gnssId: gnssValue.type === "ENUMERATED" ? gnssValue.value : undefined,
    usedInFix: usedValue.type === "BOOLEAN" && usedValue.value,
  };
}

function Satellite({ slot }: { slot: number }) {
  const telemetry = useSatelliteTelemetry(slot);
  const { azimuth, elevation, satelliteId } = telemetry;

  if (
    azimuth === undefined ||
    elevation === undefined ||
    satelliteId === undefined ||
    satelliteId <= 0 ||
    telemetry.gnssId === undefined ||
    !Number.isFinite(azimuth) ||
    elevation < 0 ||
    elevation > 90
  ) {
    return null;
  }

  const angle = (azimuth * Math.PI) / 180;
  const radius = ((90 - elevation) / 90) * 44;
  const x = 50 + Math.sin(angle) * radius;
  const y = 50 - Math.cos(angle) * radius;
  const color = satelliteGnssColor(telemetry.gnssId);

  return (
    <g
      key={`${telemetry.gnssId}-${satelliteId}`}
      opacity={telemetry.usedInFix ? 1 : 0.55}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: "transform 500ms ease-out",
      }}
    >
      <title>{`${telemetry.gnssId} ${satelliteId} · ${Math.round(azimuth)}° az · ${Math.round(elevation)}° el · ${telemetry.cno ?? "-"} dB-Hz`}</title>
      <circle
        cx="0"
        cy="0"
        r="4.2"
        fill={color}
        stroke={telemetry.usedInFix ? "white" : color}
        strokeWidth="0.5"
      />
      <text x="0" y="0" fill="white" fontSize="3.2" textAnchor="middle" dominantBaseline="central">
        {satelliteId}
      </text>
    </g>
  );
}

export function SatelliteSkyView({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-label="GNSS satellite sky view"
      role="img"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="var(--color-background)"
        fillOpacity="0.88"
        stroke="var(--color-border)"
      />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="var(--color-foreground)"
        strokeOpacity="0.55"
        strokeWidth="0.4"
      />
      <circle
        cx="50"
        cy="50"
        r="29.33"
        fill="none"
        stroke="var(--color-foreground)"
        strokeOpacity="0.3"
        strokeWidth="0.4"
      />
      <circle
        cx="50"
        cy="50"
        r="14.67"
        fill="none"
        stroke="var(--color-foreground)"
        strokeOpacity="0.3"
        strokeWidth="0.4"
      />
      <path
        d="M 6 50 H 94 M 50 6 V 94 M 18.9 18.9 L 81.1 81.1 M 81.1 18.9 L 18.9 81.1"
        stroke="var(--color-foreground)"
        strokeOpacity="0.3"
        strokeWidth="0.4"
      />
      <g
        fill="var(--color-muted-foreground)"
        fontSize="2.5"
        textAnchor="start"
        dominantBaseline="central"
      >
        <text x="51.5" y="20.67">
          30°
        </text>
        <text x="51.5" y="35.33">
          60°
        </text>
        <text x="51.5" y="50">
          90°
        </text>
      </g>
      <g fill="var(--color-orange-text)" fontSize="3.5" textAnchor="middle">
        <text x="50" y="11">
          N
        </text>
        <text x="50" y="92">
          S
        </text>
        <text x="9" y="51.2">
          W
        </text>
        <text x="91" y="51.2">
          E
        </text>
      </g>
      {satelliteSlots.map((slot) => (
        <Suspense key={slot} fallback={null}>
          <Satellite slot={slot} />
        </Suspense>
      ))}
    </svg>
  );
}
