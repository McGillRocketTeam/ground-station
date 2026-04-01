import { useAtom, useAtomSuspense } from "@effect/atom-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Suspense } from "react";
import { Map, Marker, NavigationControl } from "react-map-gl/maplibre";

import { useTheme } from "@/components/theme-provider";
import "maplibre-gl/dist/maplibre-gl.css";
import { parameterSubscriptionAtom } from "@/lib/atom";
import { atomRegistry } from "@/lib/atom-registry";
import { makeCard } from "@/lib/cards";
import {
  CoordinateLatitudeField,
  CoordinateLongitudeField,
  ParameterField,
} from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId } from "@/lib/form";

const MapCardConfiguration = Schema.Struct({
  longitude: CoordinateLongitudeField,
  latitude: CoordinateLatitudeField,

  altitude: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Rocket Altitude" }),
  ),
  rocketLong: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Rocket Longitude" }),
  ),
  rocketLat: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Rocket Latitude" }),
  ),
});

export function RocketMarker(props: { lat: string; long: string }) {
  const latValue = useAtomSuspense(parameterSubscriptionAtom(props.lat)).value
    .engValue;
  const longValue = useAtomSuspense(parameterSubscriptionAtom(props.long)).value
    .engValue;

  if (latValue.type === "FLOAT" && longValue.type === "FLOAT") {
    return (
      <Marker
        longitude={Number(longValue)}
        latitude={Number(latValue.value)}
        color="blue"
      />
    );
  }
}

type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

const viewStateAtom = Atom.make<ViewState>({
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
    const { theme } = useTheme();
    const longitude = Number(props.params.longitude);
    const latitude = Number(props.params.latitude);

    const [viewState, setViewState] = useAtom(viewStateAtom);

    return (
      <div className="relative h-full min-h-60 w-full">
        <Map
          mapStyle={
            theme === "dark"
              ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          }
          {...viewState}
          onMove={(event) => {
            setViewState(event.viewState);
          }}
          scrollZoom
          dragRotate
          doubleClickZoom
          touchZoomRotate
          keyboard
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-left" />
          <Marker longitude={longitude} latitude={latitude} color="red" />
          <Suspense>
            <RocketMarker
              lat={props.params.rocketLat.qualifiedName}
              long={props.params.rocketLong.qualifiedName}
            />
          </Suspense>
        </Map>
      </div>
    );
  },
});
