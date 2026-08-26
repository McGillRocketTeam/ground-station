import { localMapStyle, localSatelliteMapStyle } from "@mrt/map-style";
import { useRef, type ReactNode } from "react";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
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
  showLc2025Layers?: boolean;
  onClick?: () => void;
  onContextMenu?: (context: { latitude: number; longitude: number; x: number; y: number }) => void;
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
      mapStyle={props.showLc2025Layers ? localMapStyle : localSatelliteMapStyle}
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
      onContextMenu={(event) => {
        event.originalEvent.preventDefault();
        props.onContextMenu?.({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
          x: event.point.x,
          y: event.point.y,
        });
      }}
      onClick={props.onClick}
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
