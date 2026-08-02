import { useRef, type ReactNode } from "react";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

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

export function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function DashboardMap(props: {
  viewState: MapViewState;
  onViewStateChange: (viewState: MapViewState) => void;
  children?: ReactNode;
  debugName: string;
}) {
  const lastLoggedZoom = useRef<number | null>(null);

  const logMapState = (
    label: string,
    nextViewState: MapViewState,
    bounds?: { west: number; south: number; east: number; north: number },
  ) => {
    console.debug(`[${props.debugName}] ${label}`, {
      zoom: Number(nextViewState.zoom.toFixed(2)),
      longitude: Number(nextViewState.longitude.toFixed(6)),
      latitude: Number(nextViewState.latitude.toFixed(6)),
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
    <Map
      attributionControl={false}
      mapStyle={satelliteMapStyle}
      {...props.viewState}
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

        props.onViewStateChange(event.viewState);
      }}
      onMoveEnd={(event) => {
        if (!import.meta.env.DEV) return;

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
      {props.children}
    </Map>
  );
}
