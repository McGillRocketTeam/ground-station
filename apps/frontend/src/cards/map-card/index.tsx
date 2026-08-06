import { useAtom, useAtomSuspense } from "@effect/atom-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Suspense } from "react";
import { Marker } from "react-map-gl/maplibre";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { atomRegistry } from "@/lib/atom-registry";
import { makeCard } from "@/lib/cards";
import { CoordinateLatitudeField, CoordinateLongitudeField } from "@/lib/dashboard-field-types";
import {
  FormDefaultValueAnnotationId,
  FormTitleAnnotationId,
  FormTypeAnnotationId,
} from "@/lib/form";

import { PredictionAnnotations } from "../prediction-map-card/prediction-annotations";
import { SatelliteSkyView } from "../satellite-sky-view";
import { DashboardMap, isValidCoordinate, type MapViewState } from "./map";

const MapCardConfiguration = Schema.Struct({
  longitude: Schema.optional(CoordinateLongitudeField).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Ground Station Longitude" }),
  ),
  latitude: Schema.optional(CoordinateLatitudeField).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Ground Station Latitude" }),
  ),
  useLocalTiles: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({
      [FormDefaultValueAnnotationId]: true,
      [FormTitleAnnotationId]: "Use Local Map Tiles",
      [FormTypeAnnotationId]: "boolean",
    }),
  ),
  showLc2025Layers: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({
      [FormDefaultValueAnnotationId]: true,
      [FormTitleAnnotationId]: "Show LC2025 Layers",
      [FormTypeAnnotationId]: "boolean",
    }),
  ),
  showLandingPrediction: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({
      [FormDefaultValueAnnotationId]: false,
      [FormTitleAnnotationId]: "Show Landing Prediction",
      [FormTypeAnnotationId]: "boolean",
    }),
  ),
  showSatelliteSkyView: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({
      [FormDefaultValueAnnotationId]: true,
      [FormTitleAnnotationId]: "Show Satellite Sky View",
      [FormTypeAnnotationId]: "boolean",
    }),
  ),
});

function RocketMarker(props: { lat: string; long: string; color: string }) {
  const latitude = useAtomSuspense(parameterSubscriptionAtom(props.lat))
    .value as LiveParameterUpdate;
  const longitude = useAtomSuspense(parameterSubscriptionAtom(props.long))
    .value as LiveParameterUpdate;
  const latValue = latitude.value.engValue;
  const longValue = longitude.value.engValue;

  if (latValue.type === "FLOAT" && longValue.type === "FLOAT") {
    const latitude = Number(latValue.value);
    const longitude = Number(longValue.value);

    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    return <Marker longitude={longitude} latitude={latitude} color={props.color} />;
  }
}

function flightComputerParameter(system: "SystemA" | "SystemB", parameterName: string) {
  return `/${system}/Rocket/FlightComputer/${parameterName}`;
}

const viewStateAtom = Atom.make<MapViewState>({
  longitude: -81.86,
  latitude: 48,
  zoom: 11,
});

export const MapCard = makeCard({
  id: "map-card",
  name: "Map Card",
  schema: MapCardConfiguration,
  actions: (card) => [
    {
      id: "map-actions",
      heading: "Map",
      actions: [
        {
          id: "recenter-map",
          label: "Recenter Map",
          shortcut: "Mod+Alt+R",
          run: () => {
            if (!card.params) {
              return;
            }

            const longitude = Number(card.params.longitude);
            const latitude = Number(card.params.latitude);

            if (!isValidCoordinate(latitude, longitude)) {
              return;
            }

            atomRegistry.set(viewStateAtom, {
              zoom: 10,
              longitude,
              latitude,
            });
          },
        },
      ],
    },
  ],
  component: (props) => {
    const longitude = Number(props.params.longitude);
    const latitude = Number(props.params.latitude);
    const padCoordinate = isValidCoordinate(latitude, longitude)
      ? { latitude, longitude }
      : undefined;

    const [viewState, setViewState] = useAtom(viewStateAtom);
    return (
      <div className="relative h-full min-h-60 w-full">
        <DashboardMap
          debugName="map-card"
          viewState={viewState}
          onViewStateChange={setViewState}
          useLocalTiles={props.params.useLocalTiles ?? true}
          showLc2025Layers={props.params.showLc2025Layers ?? true}
        >
          {padCoordinate ? (
            <Marker
              longitude={padCoordinate.longitude}
              latitude={padCoordinate.latitude}
              color="red"
            />
          ) : null}
          <Suspense>
            <RocketMarker
              lat={flightComputerParameter("SystemA", "gps_latitude")}
              long={flightComputerParameter("SystemA", "gps_longitude")}
              color="#2563eb"
            />
          </Suspense>
          <Suspense>
            <RocketMarker
              lat={flightComputerParameter("SystemB", "gps_latitude")}
              long={flightComputerParameter("SystemB", "gps_longitude")}
              color="#db2777"
            />
          </Suspense>
          {props.params.showLandingPrediction ? (
            <>
              <Suspense>
                <PredictionAnnotations
                  id="prediction-system-a"
                  color="#f59e0b"
                  outlineColor="#fbbf24"
                  accuracy={flightComputerParameter("SystemA", "predicted_location_accuracy")}
                  latitude={flightComputerParameter("SystemA", "predicted_location_latitude")}
                  longitude={flightComputerParameter("SystemA", "predicted_location_longitude")}
                />
              </Suspense>
              <Suspense>
                <PredictionAnnotations
                  id="prediction-system-b"
                  color="#06b6d4"
                  outlineColor="#67e8f9"
                  accuracy={flightComputerParameter("SystemB", "predicted_location_accuracy")}
                  latitude={flightComputerParameter("SystemB", "predicted_location_latitude")}
                  longitude={flightComputerParameter("SystemB", "predicted_location_longitude")}
                />
              </Suspense>
            </>
          ) : null}
        </DashboardMap>
        {(props.params.showSatelliteSkyView ?? true) ? (
          <SatelliteSkyView className="pointer-events-none absolute bottom-3 left-3 size-[min(42vw,18rem)] min-h-48 min-w-48" />
        ) : null}
      </div>
    );
  },
});
