import { useAtomSuspense } from "@effect/atom-react";
import { Schema } from "effect";
import { Suspense, useEffect, useRef, useState } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";

import type { LiveParameterUpdate } from "@/lib/atom";

import { DashboardMap, isValidCoordinate } from "@/cards/map-card/map";
import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { ParameterField } from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId } from "@/lib/form";

const PredictionMapConfiguration = Schema.Struct({
  accuracy: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Predicted Location Accuracy" }),
  ),
  latitude: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Predicted Location Latitude" }),
  ),
  longitude: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Predicted Location Longitude" }),
  ),
});

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

function PredictionAnnotations(props: {
  accuracy: string;
  latitude: string;
  longitude: string;
  onInitialCoordinate: (longitude: number, latitude: number) => void;
}) {
  const accuracy = useNumericParameter(props.accuracy);
  const latitude = useNumericParameter(props.latitude);
  const longitude = useNumericParameter(props.longitude);
  const validCoordinate =
    latitude !== undefined && longitude !== undefined && isValidCoordinate(latitude, longitude);
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!validCoordinate || hasCentered.current) return;

    hasCentered.current = true;
    props.onInitialCoordinate(longitude, latitude);
  }, [latitude, longitude, props, validCoordinate]);

  if (!validCoordinate) return null;

  return (
    <>
      {accuracy !== undefined && Number.isFinite(accuracy) && accuracy > 0 ? (
        <Source
          id="prediction-accuracy-source"
          data={makeAccuracyCircle(longitude, latitude, accuracy)}
          type="geojson"
        >
          <Layer
            id="prediction-accuracy-fill"
            type="fill"
            paint={{ "fill-color": "#f59e0b", "fill-opacity": 0.22 }}
          />
          <Layer
            id="prediction-accuracy-outline"
            type="line"
            paint={{ "line-color": "#fbbf24", "line-width": 2 }}
          />
        </Source>
      ) : null}
      <Marker longitude={longitude} latitude={latitude} color="#f59e0b" />
    </>
  );
}

function PredictionMap(props: { accuracy: string; latitude: string; longitude: string }) {
  const [viewState, setViewState] = useState({
    longitude: -73.5673,
    latitude: 45.5017,
    zoom: 10,
  });

  return (
    <DashboardMap
      debugName="prediction-map-card"
      viewState={viewState}
      onViewStateChange={setViewState}
    >
      <Suspense>
        <PredictionAnnotations
          accuracy={props.accuracy}
          latitude={props.latitude}
          longitude={props.longitude}
          onInitialCoordinate={(longitude, latitude) => {
            setViewState((current) => ({ ...current, longitude, latitude }));
          }}
        />
      </Suspense>
    </DashboardMap>
  );
}

export const PredictionMapCard = makeCard({
  id: "prediction-map-card",
  name: "Prediction Map Card",
  schema: PredictionMapConfiguration,
  component: (props) => (
    <div className="relative h-full min-h-60 w-full">
      <PredictionMap
        accuracy={props.params.accuracy.qualifiedName}
        latitude={props.params.latitude.qualifiedName}
        longitude={props.params.longitude.qualifiedName}
      />
    </div>
  ),
});
