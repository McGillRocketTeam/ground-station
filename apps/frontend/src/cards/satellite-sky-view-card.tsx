import { Schema } from "effect";
import { Suspense } from "react";

import {
  satelliteGnssColor,
  SatelliteSkyView,
  useSatelliteTelemetry,
} from "@/cards/satellite-sky-view";
import { DataGridBody, DataGridHead, DataGridHeader, DataGridRow } from "@/components/ui/data-grid";
import { makeCard } from "@/lib/cards";

const satelliteSlots = Array.from({ length: 8 }, (_, index) => index + 1);

function formatNumber(value: number | undefined, suffix = "") {
  return value === undefined ? "-" : `${Math.round(value)}${suffix}`;
}

function SatelliteDataRow({ slot }: { slot: number }) {
  const telemetry = useSatelliteTelemetry(slot);

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

export const SatelliteSkyViewCard = makeCard({
  id: "satellite-sky-view-card",
  name: "Satellite Sky View",
  schema: Schema.Struct({}),
  component: () => (
    <div className="grid size-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background">
      <div className="flex min-h-0 items-center justify-center p-3">
        <SatelliteSkyView className="size-full" />
      </div>

      <div className="overflow-x-auto border-t bg-border">
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
                <SatelliteDataRow slot={slot} />
              </Suspense>
            ))}
          </DataGridBody>
        </div>
      </div>
    </div>
  ),
});
