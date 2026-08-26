import { useAtomValue } from "@effect/atom-react";
import { Cause, Effect, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Suspense } from "react";

import {
  satelliteGnssColor,
  SatelliteSkyView,
  type SatelliteSystem,
  useSatelliteTelemetry,
} from "@/cards/satellite-sky-view";
import { DataGridBody, DataGridHead, DataGridHeader, DataGridRow } from "@/components/ui/data-grid";
import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import {
  FormDefaultValueAnnotationId,
  FormTitleAnnotationId,
  FormTypeAnnotationId,
} from "@/lib/form";

const satelliteSlots = Array.from({ length: 8 }, (_, index) => index + 1);
const gpsParameters = [
  ["GPS Fix OK", "gps_fix_ok"],
  ["GPS Fix Type", "gps_fix_type"],
  ["GPS Ground Speed", "gps_ground_speed"],
  ["GPS Heading of Motion", "gps_heading_motion"],
  ["GPS Horizontal Accuracy", "gps_horizontal_accuracy"],
  ["GPS Vertical Accuracy", "gps_vertical_accuracy"],
  ["GPS PDOP", "gps_pdop"],
  ["GPS Satellites Connected", "gps_satellites_connected"],
] as const;

function formatNumber(value: number | undefined, suffix = "") {
  return value === undefined ? "-" : `${Math.round(value)}${suffix}`;
}

function SatelliteDataRow({ slot, system }: { slot: number; system: SatelliteSystem }) {
  const telemetry = useSatelliteTelemetry(slot, system);

  return (
    <DataGridRow className="*:py-0.5">
      <div>{telemetry.slot}</div>
      <div>{formatNumber(telemetry.satelliteId)}</div>
      <div className="flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: satelliteGnssColor(telemetry.gnssId) }}
        />
        {telemetry.gnssId ?? "-"}
      </div>
      <div className="text-right">{formatNumber(telemetry.azimuth, "°")}</div>
      <div className="text-right">{formatNumber(telemetry.elevation, "°")}</div>
      <div className="text-right">{formatNumber(telemetry.cno)}</div>
      <div>{telemetry.usedInFix ? "YES" : "NO"}</div>
    </DataGridRow>
  );
}

function PendingSatelliteDataRow({ slot }: { slot: number }) {
  return (
    <DataGridRow className="*:py-0.5 *:text-muted-foreground">
      <div>{slot}</div>
      <div className="col-span-6">Awaiting telemetry</div>
    </DataGridRow>
  );
}

function GpsParameterRow({
  label,
  parameter,
  system,
}: {
  label: string;
  parameter: string;
  system: SatelliteSystem;
}) {
  const result = useAtomValue(
    parameterSubscriptionAtom(`/${system}/Rocket/FlightComputer/${parameter}`),
  );

  return (
    <DataGridRow className="*:py-0.5">
      <div>{label}</div>
      {AsyncResult.match(result, {
        onInitial: () => <div className="text-right text-muted-foreground">Awaiting Value</div>,
        onFailure: ({ cause }) => (
          <div className="text-right text-error" title={Cause.pretty(cause)}>
            Error
          </div>
        ),
        onSuccess: ({ value }) => (
          <div className="text-right">
            {"value" in value.value.engValue
              ? value.value.engValue.value.toLocaleString()
              : "Unknown Value Type"}{" "}
            {value.info.type.unitSet?.map((unit) => unit.unit).join("")}
          </div>
        ),
      })}
    </DataGridRow>
  );
}

export const SatelliteSkyViewCard = makeCard({
  id: "satellite-sky-view-card",
  name: "Satellite Sky View",
  schema: Schema.Struct({
    system: Schema.Literals(["SystemA", "SystemB"]).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed("SystemA")),
      Schema.annotate({
        [FormDefaultValueAnnotationId]: "SystemA",
        [FormTitleAnnotationId]: "System",
        [FormTypeAnnotationId]: "string",
      }),
    ),
  }),
  component: ({ params }) => {
    const system = params.system ?? "SystemA";

    return (
      <div className="grid size-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background">
        <div className="flex min-h-0 items-center justify-center p-3">
          <SatelliteSkyView className="size-full" system={system} />
        </div>

        <div className="overflow-auto border-t bg-border">
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-px">
            <DataGridHeader className="sticky top-0 z-10 bg-background">
              <DataGridHead>Slot</DataGridHead>
              <DataGridHead>SV ID</DataGridHead>
              <DataGridHead>GNSS</DataGridHead>
              <DataGridHead className="text-right">Az</DataGridHead>
              <DataGridHead className="text-right">El</DataGridHead>
              <DataGridHead className="text-right">C/N0</DataGridHead>
              <DataGridHead>Fix</DataGridHead>
            </DataGridHeader>
            <DataGridBody>
              {satelliteSlots.map((slot) => (
                <Suspense key={slot} fallback={<PendingSatelliteDataRow slot={slot} />}>
                  <SatelliteDataRow slot={slot} system={system} />
                </Suspense>
              ))}
            </DataGridBody>
          </div>

          <div className="mt-px grid grid-cols-[minmax(12rem,1fr)_minmax(8rem,0.7fr)] gap-px">
            <DataGridHeader className="sticky top-0 z-10 bg-background">
              <DataGridHead>Parameter</DataGridHead>
              <DataGridHead className="text-right">
                {system === "SystemA" ? "System A" : "System B"}
              </DataGridHead>
            </DataGridHeader>
            <DataGridBody>
              {gpsParameters.map(([label, parameter]) => (
                <GpsParameterRow
                  key={parameter}
                  label={label}
                  parameter={parameter}
                  system={system}
                />
              ))}
            </DataGridBody>
          </div>
        </div>
      </div>
    );
  },
});
