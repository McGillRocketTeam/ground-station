import { useAtomSuspense } from "@effect/atom-react";
import { localSatelliteMapStyle } from "@mrt/map-style";
import { useEffect, useRef } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import { STAGE_COLORS } from "..";
import { flightReplayGpsPathAtom, flightReplayGpsStateAtom, flightReplayStateAtom } from "../data";

const parameterNumber = (
  parameters: Readonly<Record<string, string | undefined>> | undefined,
  name: string,
) => {
  const value = Number(parameters?.[name]);
  return Number.isFinite(value) ? value : undefined;
};

const toPathSegmentOpacity = (segmentIndex: number, segmentCount: number) => {
  if (segmentCount <= 1) {
    return 1;
  }

  return segmentIndex / (segmentCount - 1);
};

const toPathSegmentColor = (flightStage: string) => STAGE_COLORS[flightStage] ?? "#ff0000";

const formatCoordinateParts = (value: number | undefined, fractionDigits: number) => {
  if (value === undefined) {
    return { whole: "-", fraction: "" };
  }

  const formatted = value.toFixed(fractionDigits);
  const [integer, fraction = ""] = formatted.split(".");

  return {
    whole: integer,
    fraction,
  };
};

function CoordinateValue({
  value,
  fractionDigits,
}: {
  value: number | undefined;
  fractionDigits: number;
}) {
  const parts = formatCoordinateParts(value, fractionDigits);

  return (
    <div className="grid w-[16.5ch] grid-cols-[4ch_1ch_auto] px-1 text-xs text-orange-text">
      <span className="justify-self-end">{parts.whole}</span>
      <span>{parts.fraction ? "." : ""}</span>
      <span>{parts.fraction}</span>
    </div>
  );
}

const rocketPathLayer = {
  id: "rocket-path",
  type: "line" as const,
  layout: {
    "line-join": "round" as const,
    "line-cap": "round" as const,
  },
  paint: {
    "line-color": ["coalesce", ["get", "color"], "#ff0000"],
    "line-opacity": ["coalesce", ["get", "opacity"], 1],
    "line-width": 3,
  },
} as any;

function RocketMarker() {
  const gpsState = useAtomSuspense(flightReplayGpsStateAtom).value;

  if (!gpsState) {
    return null;
  }

  return (
    <Marker longitude={gpsState.longitude} latitude={gpsState.latitude} anchor="center">
      <div className="pointer-events-none relative h-16 w-16">
        <div className="absolute left-1/2 top-0 h-[calc(50%-10px)] w-px -translate-x-1/2 bg-red-500" />
        <div className="absolute bottom-0 left-1/2 h-[calc(50%-10px)] w-px -translate-x-1/2 bg-red-500" />
        <div className="absolute left-0 top-1/2 h-px w-[calc(50%-10px)] -translate-y-1/2 bg-red-500" />
        <div className="absolute right-0 top-1/2 h-px w-[calc(50%-10px)] -translate-y-1/2 bg-red-500" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
      </div>
    </Marker>
  );
}

function RocketPath() {
  const gpsPath = useAtomSuspense(flightReplayGpsPathAtom).value;

  if (gpsPath.length < 2) {
    return null;
  }

  const data = {
    type: "FeatureCollection" as const,
    features: gpsPath.slice(1).map((point, index, segments) => ({
      type: "Feature" as const,
      properties: {
        color: toPathSegmentColor(point.flightStage),
        opacity: toPathSegmentOpacity(index, segments.length),
      },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [gpsPath[index].longitude, gpsPath[index].latitude],
          [point.longitude, point.latitude],
        ],
      },
    })),
  };

  return (
    <Source id="rocket-path" type="geojson" data={data}>
      <Layer {...rocketPathLayer} />
    </Source>
  );
}

export const MapPanel = () => {
  const gpsState = useAtomSuspense(flightReplayGpsStateAtom).value;
  const replay = useAtomSuspense(flightReplayStateAtom).value;
  const finalGps = replay.gpsTrack[replay.gpsTrack.length - 1];
  const finalPacket = replay.packets[replay.packets.length - 1];
  const predictedLatitude = parameterNumber(
    finalPacket?.parameters,
    "/SystemA/Rocket/FlightComputer/predicted_location_latitude",
  );
  const predictedLongitude = parameterNumber(
    finalPacket?.parameters,
    "/SystemA/Rocket/FlightComputer/predicted_location_longitude",
  );
  const predictedAccuracy = parameterNumber(
    finalPacket?.parameters,
    "/SystemA/Rocket/FlightComputer/predicted_location_accuracy",
  );
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (!mapRef.current || !gpsState) {
      return;
    }

    mapRef.current.jumpTo({
      center: [gpsState.longitude, gpsState.latitude],
    });
  }, [gpsState]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        scrollZoom={{ around: "center" }}
        initialViewState={{
          longitude: -81.86,
          latitude: 48,
          zoom: 14,
        }}
        mapStyle={localSatelliteMapStyle}
      >
        <RocketPath />
        <RocketMarker />
        {finalGps ? (
          <Marker longitude={finalGps.longitude} latitude={finalGps.latitude} anchor="center">
            <div
              className="size-3 rounded-full border-2 border-white bg-emerald-500 shadow"
              title="Final recorded GPS position"
            />
          </Marker>
        ) : null}
        {predictedLatitude !== undefined && predictedLongitude !== undefined ? (
          <Marker longitude={predictedLongitude} latitude={predictedLatitude} anchor="center">
            <div
              className="size-4 rotate-45 border-2 border-white bg-amber-400 shadow"
              title={`Final predicted landing position${predictedAccuracy === undefined ? "" : `, ${predictedAccuracy.toFixed(0)} m search radius`}`}
            />
          </Marker>
        ) : null}
      </Map>

      <div className="flex flex-col border font-mono text-xs absolute top-4 right-4 bg-background">
        <div className="w-full bg-border text-center font-semibold text-muted-foreground">
          GPS POSITION
        </div>

        <CoordinateValue value={gpsState?.latitude} fractionDigits={4} />
        <CoordinateValue value={gpsState?.longitude} fractionDigits={6} />
        <div className="mt-1 border-t border-border px-1 text-[10px] text-muted-foreground">
          Green: final GPS
        </div>
        <div className="px-1 text-[10px] text-muted-foreground">Amber: prediction</div>
      </div>
    </div>
  );
};
