import type { PrimarySystem } from "@mrt/media-state";
import type { StyleSpecification } from "maplibre-gl";

import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { Map, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { OverlayCard } from "../components/overlay-card.tsx";
import { parameterSubscriptionAtom } from "../state/parameter-atoms.ts";
import { flightComputerParameter } from "../state/parameter-path.ts";

const mapStyle = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
      ],
      tileSize: 256,
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
} satisfies StyleSpecification;

const numericValue = (result: ReturnType<typeof useParameter>) =>
  AsyncResult.match(result, {
    onInitial: () => undefined,
    onFailure: () => undefined,
    onSuccess: ({ value: update }) => {
      const value = update.value.engValue;
      const numeric = "value" in value ? Number(value.value) : Number.NaN;
      return Number.isFinite(numeric) ? numeric : undefined;
    },
  });

function useParameter(qualifiedName: string) {
  return useAtomValue(parameterSubscriptionAtom(qualifiedName));
}

export function getFlightStage(result: ReturnType<typeof useParameter>) {
  return AsyncResult.match(result, {
    onInitial: () => undefined,
    onFailure: () => undefined,
    onSuccess: ({ value: update }) => {
      const value = update.value.rawValue ?? update.value.engValue;
      const stage = "value" in value ? Number(value.value) : Number.NaN;
      return Number.isInteger(stage) ? stage : undefined;
    },
  });
}

export function FlightTrackingCard({ primarySystem }: { primarySystem: PrimarySystem }) {
  const stage = getFlightStage(
    useParameter(flightComputerParameter(primarySystem, "flight_stage")),
  );
  const latitude = numericValue(
    useParameter(flightComputerParameter(primarySystem, "gps_latitude")),
  );
  const longitude = numericValue(
    useParameter(flightComputerParameter(primarySystem, "gps_longitude")),
  );
  const hasPosition =
    latitude !== undefined &&
    longitude !== undefined &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  return (
    <OverlayCard title="Flight Tracking">
      <div className="w-96">
        <div className="aspect-video overflow-hidden border border-white/25 bg-black/50">
          {hasPosition ? (
            <Map
              attributionControl={false}
              latitude={latitude}
              longitude={longitude}
              mapStyle={mapStyle}
              pitchWithRotate={false}
              dragRotate={false}
              zoom={12}
            >
              <Marker latitude={latitude} longitude={longitude} color="#3B82F6" />
            </Map>
          ) : (
            <div className="grid h-full place-items-center opacity-50 uppercase">Awaiting GPS</div>
          )}
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 pt-2 uppercase">
          <div>Drogue Chute</div>
          <RecoveryStatus
            deployed={stage !== undefined && stage >= 3}
            known={stage !== undefined}
          />
          <div>Main Chute</div>
          <RecoveryStatus
            deployed={stage !== undefined && stage >= 4}
            known={stage !== undefined}
          />
          <div>Position</div>
          <div className="text-right tabular-nums">
            {hasPosition ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : "N/A"}
          </div>
        </div>
      </div>
    </OverlayCard>
  );
}

function RecoveryStatus({ deployed, known }: { deployed: boolean; known: boolean }) {
  return (
    <div className={known ? "text-right" : "text-right opacity-50"}>
      {known ? (deployed ? "DEPLOYED" : "STOWED") : "N/A"}
    </div>
  );
}
