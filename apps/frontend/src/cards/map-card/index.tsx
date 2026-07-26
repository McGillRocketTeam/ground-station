import { useAtom, useAtomSuspense } from "@effect/atom-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Suspense, useRef } from "react";
import { Map, Marker } from "react-map-gl/maplibre";

import type { LiveParameterUpdate } from "@/lib/atom";
import "maplibre-gl/dist/maplibre-gl.css";
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

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

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

const satelliteMapStyle = {
  version: 8 as const,
  sources: {
    satellite: {
      type: "raster" as const,
      tiles: [
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
      ],
      tileSize: 256,
    },
  },
  layers: [{ id: "satellite", type: "raster" as const, source: "satellite" }],
};

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
    const longitude = Number(props.params.longitude);
    const latitude = Number(props.params.latitude);
    const padCoordinate = isValidCoordinate(latitude, longitude)
      ? { latitude, longitude }
      : undefined;

    const [viewState, setViewState] = useAtom(viewStateAtom);
    const useLocalTiles = false;
    const lastLoggedZoom = useRef<number | null>(null);

    const logMapState = (
      label: string,
      nextViewState: { longitude: number; latitude: number; zoom: number },
      bounds?: {
        west: number;
        south: number;
        east: number;
        north: number;
      },
    ) => {
      console.debug(`[map-card] ${label}`, {
        zoom: Number(nextViewState.zoom.toFixed(2)),
        longitude: Number(nextViewState.longitude.toFixed(6)),
        latitude: Number(nextViewState.latitude.toFixed(6)),
        usingLocalTiles: useLocalTiles,
        bounds:
          bounds === undefined
            ? undefined
            : {
                west: Number(bounds.west.toFixed(6)),
                south: Number(bounds.south.toFixed(6)),
                east: Number(bounds.east.toFixed(6)),
                north: Number(bounds.north.toFixed(6)),
              },
      });
    };

    return (
      <div className="relative h-full min-h-60 w-full">
        <Map
          attributionControl={false}
          // Previous style: useLocalTiles ? customMapStyle : basicMapStyle(theme)
          mapStyle={satelliteMapStyle}
          {...viewState}
          onMove={(event) => {
            if (import.meta.env.DEV) {
              const nextZoom = event.viewState.zoom;

              if (
                lastLoggedZoom.current === null ||
                Math.abs(nextZoom - lastLoggedZoom.current) >= 0.05
              ) {
                logMapState("zoom", event.viewState);
                lastLoggedZoom.current = nextZoom;
              }
            }

            setViewState(event.viewState);
          }}
          onMoveEnd={(event) => {
            if (!import.meta.env.DEV) {
              return;
            }

            const bounds = event.target.getBounds();

            logMapState("moveend", event.viewState, {
              west: bounds.getWest(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              north: bounds.getNorth(),
            });
          }}
          scrollZoom
          dragRotate
          doubleClickZoom
          touchZoomRotate
          keyboard
          style={{ width: "100%", height: "100%" }}
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
              lat={props.params.rocketLat.qualifiedName}
              long={props.params.rocketLong.qualifiedName}
            />
          </Suspense>
        </Map>
        {(props.params.showSatelliteSkyView ?? true) ? (
          <SatelliteSkyView className="pointer-events-none absolute bottom-3 left-3 size-[min(42vw,18rem)] min-h-48 min-w-48" />
        ) : null}
      </div>
    );
  },
});
