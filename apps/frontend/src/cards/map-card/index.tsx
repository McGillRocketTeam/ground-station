import { useAtom, useAtomSuspense } from "@effect/atom-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Suspense } from "react";
import { Marker } from "react-map-gl/maplibre";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { atomRegistry } from "@/lib/atom-registry";
import { makeCard } from "@/lib/cards";
import {
  CoordinateLatitudeField,
  CoordinateLongitudeField,
  ParameterField,
} from "@/lib/dashboard-field-types";
import {
  FormDefaultValueAnnotationId,
  FormTitleAnnotationId,
  FormTypeAnnotationId,
} from "@/lib/form";

import { SatelliteSkyView } from "../satellite-sky-view";
import { DashboardMap, isValidCoordinate, type MapViewState } from "./map";

const MapCardConfiguration = Schema.Struct({
  longitude: CoordinateLongitudeField,
  latitude: CoordinateLatitudeField,

  altitude: ParameterField.pipe(Schema.annotate({ [FormTitleAnnotationId]: "Rocket Altitude" })),
  rocketLong: ParameterField.pipe(Schema.annotate({ [FormTitleAnnotationId]: "Rocket Longitude" })),
  rocketLat: ParameterField.pipe(Schema.annotate({ [FormTitleAnnotationId]: "Rocket Latitude" })),
  showSatelliteSkyView: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({
      [FormDefaultValueAnnotationId]: true,
      [FormTitleAnnotationId]: "Show Satellite Sky View",
      [FormTypeAnnotationId]: "boolean",
    }),
  ),
});

function RocketMarker(props: { lat: string; long: string }) {
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

    return <Marker longitude={longitude} latitude={latitude} color="blue" />;
  }
}

const viewStateAtom = Atom.make<MapViewState>({
  longitude: -73.5673,
  latitude: 45.5017,
  zoom: 10,
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

            atomRegistry.set(viewStateAtom, {
              zoom: 10,
              longitude: Number(card.params.longitude),
              latitude: Number(card.params.latitude),
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
        <DashboardMap debugName="map-card" viewState={viewState} onViewStateChange={setViewState}>
          {padCoordinate ? (
            <Marker
              longitude={padCoordinate.longitude}
              latitude={padCoordinate.latitude}
              color="red"
            />
          ) : null}
          <Suspense>
            <RocketMarker
              lat={props.params.rocketLat.qualifiedName}
              long={props.params.rocketLong.qualifiedName}
            />
          </Suspense>
        </DashboardMap>
        {(props.params.showSatelliteSkyView ?? true) ? (
          <SatelliteSkyView className="pointer-events-none absolute bottom-3 left-3 size-[min(42vw,18rem)] min-h-48 min-w-48" />
        ) : null}
      </div>
    );
  },
});
