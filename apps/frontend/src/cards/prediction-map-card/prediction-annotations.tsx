import { useAtomSuspense } from "@effect/atom-react";
import { useEffect, useRef } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";

import type { LiveParameterUpdate } from "@/lib/atom";

import { isValidCoordinate } from "@/cards/map-card/map";
import { parameterSubscriptionAtom } from "@/lib/atom";

function useNumericParameter(qualifiedName: string) {
  const update = useAtomSuspense(parameterSubscriptionAtom(qualifiedName))
    .value as LiveParameterUpdate;
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

function makeAccuracyCircle(longitude: number, latitude: number, radiusMeters: number) {
  const earthRadiusMeters = 6_371_008.8;
  const angularDistance = radiusMeters / earthRadiusMeters;
  const centerLatitude = (latitude * Math.PI) / 180;
  const centerLongitude = (longitude * Math.PI) / 180;
  const coordinates: [number, number][] = [];

  for (let index = 0; index <= 64; index++) {
    const bearing = (index / 64) * Math.PI * 2;
    const pointLatitude = Math.asin(
      Math.sin(centerLatitude) * Math.cos(angularDistance) +
        Math.cos(centerLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude =
      centerLongitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatitude),
        Math.cos(angularDistance) - Math.sin(centerLatitude) * Math.sin(pointLatitude),
      );

    coordinates.push([(pointLongitude * 180) / Math.PI, (pointLatitude * 180) / Math.PI]);
  }

  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}

export function PredictionAnnotations(props: {
  id?: string;
  color?: string;
  outlineColor?: string;
  accuracy: string;
  latitude: string;
  longitude: string;
  onInitialCoordinate?: (longitude: number, latitude: number) => void;
}) {
  const accuracy = useNumericParameter(props.accuracy);
  const latitude = useNumericParameter(props.latitude);
  const longitude = useNumericParameter(props.longitude);
  const id = props.id ?? "prediction";
  const color = props.color ?? "#f59e0b";
  const outlineColor = props.outlineColor ?? "#fbbf24";
  const validCoordinate =
    latitude !== undefined && longitude !== undefined && isValidCoordinate(latitude, longitude);
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!validCoordinate || hasCentered.current || !props.onInitialCoordinate) return;

    hasCentered.current = true;
    props.onInitialCoordinate(longitude, latitude);
  }, [latitude, longitude, props.onInitialCoordinate, validCoordinate]);

  if (!validCoordinate) return null;

  return (
    <>
      {accuracy !== undefined && Number.isFinite(accuracy) && accuracy > 0 ? (
        <Source
          id={`${id}-accuracy-source`}
          data={makeAccuracyCircle(longitude, latitude, accuracy)}
          type="geojson"
        >
          <Layer
            id={`${id}-accuracy-fill`}
            type="fill"
            paint={{ "fill-color": color, "fill-opacity": 0.22 }}
          />
          <Layer
            id={`${id}-accuracy-outline`}
            type="line"
            paint={{ "line-color": outlineColor, "line-width": 2 }}
          />
        </Source>
      ) : null}
      <Marker longitude={longitude} latitude={latitude} color={color} />
    </>
  );
}
