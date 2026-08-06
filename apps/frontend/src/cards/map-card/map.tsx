import type { StyleSpecification } from "maplibre-gl";

import { useRef, type ReactNode } from "react";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { eoxMapStyle, localMapStyle, resolveMbtileserverBaseUrl } from "./style";

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

const mbtileserverBaseUrl = resolveMbtileserverBaseUrl();

const localLc2025MapStyle = {
  version: 8,
  sources: {
    ...localMapStyle.sources,
    lc2025: {
      type: "vector",
      tiles: [`${mbtileserverBaseUrl}/lc2025/tiles/{z}/{x}/{y}.pbf`],
      bounds: [-82.015314, 47.750009, -81.500004, 48.250009],
      minzoom: 8,
      maxzoom: 16,
    },
  },
  layers: [
    ...localMapStyle.layers,
    {
      id: "lc2025-wetlands",
      type: "fill",
      source: "lc2025",
      "source-layer": "wetlands",
      minzoom: 10,
      paint: {
        "fill-color": "#8b5a2b",
        "fill-opacity": 0.32,
        "fill-outline-color": "#d6a56f",
      },
    },
    {
      id: "lc2025-waterbodies",
      type: "fill",
      source: "lc2025",
      "source-layer": "waterbodies",
      paint: {
        "fill-color": "#2563a6",
        "fill-opacity": 0.58,
        "fill-outline-color": "#7dd3fc",
      },
    },
    {
      id: "lc2025-contours",
      type: "line",
      source: "lc2025",
      "source-layer": "contours",
      minzoom: 12,
      paint: {
        "line-color": "#d8b4fe",
        "line-opacity": 0.65,
        "line-width": 1,
      },
    },
    {
      id: "lc2025-watercourses",
      type: "line",
      source: "lc2025",
      "source-layer": "watercourses",
      minzoom: 10,
      paint: {
        "line-color": "#38bdf8",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 2.5],
      },
    },
    {
      id: "lc2025-roads-casing",
      type: "line",
      source: "lc2025",
      "source-layer": "roads",
      minzoom: 9,
      paint: {
        "line-color": "#3f0a0a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 16, 6],
      },
    },
    {
      id: "lc2025-roads",
      type: "line",
      source: "lc2025",
      "source-layer": "roads",
      minzoom: 9,
      paint: {
        "line-color": "#ef4444",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 16, 3.5],
      },
    },
    {
      id: "lc2025-trails",
      type: "line",
      source: "lc2025",
      "source-layer": "trails",
      minzoom: 11,
      paint: {
        "line-color": "#fb923c",
        "line-width": 2,
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "lc2025-railways",
      type: "line",
      source: "lc2025",
      "source-layer": "railways",
      minzoom: 10,
      paint: {
        "line-color": "#f8fafc",
        "line-width": 2,
        "line-dasharray": [1, 1],
      },
    },
    {
      id: "lc2025-power-lines",
      type: "line",
      source: "lc2025",
      "source-layer": "power_lines",
      minzoom: 11,
      paint: {
        "line-color": "#facc15",
        "line-width": 1.5,
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "lc2025-identified-paths-casing",
      type: "line",
      source: "lc2025",
      "source-layer": "identified_paths",
      minzoom: 10,
      paint: {
        "line-color": "#172554",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 7],
      },
    },
    {
      id: "lc2025-identified-paths",
      type: "line",
      source: "lc2025",
      "source-layer": "identified_paths",
      minzoom: 10,
      paint: {
        "line-color": "#bef264",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 4],
      },
    },
    {
      id: "lc2025-buildings",
      type: "circle",
      source: "lc2025",
      "source-layer": "buildings",
      minzoom: 13,
      paint: {
        "circle-color": "#e2e8f0",
        "circle-radius": 2.5,
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1,
      },
    },
    {
      id: "lc2025-named-features",
      type: "circle",
      source: "lc2025",
      "source-layer": "named_features",
      minzoom: 12,
      paint: {
        "circle-color": "#f8fafc",
        "circle-radius": 3,
        "circle-stroke-color": "#334155",
        "circle-stroke-width": 1,
      },
    },
    {
      id: "lc2025-launch-sites",
      type: "circle",
      source: "lc2025",
      "source-layer": "launch_sites",
      minzoom: 8,
      paint: {
        "circle-color": "#f43f5e",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 16, 9],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
  ],
} satisfies StyleSpecification;

const eoxLc2025MapStyle = {
  ...localLc2025MapStyle,
  name: "EOX Satellite + LC2025",
  sources: {
    ...eoxMapStyle.sources,
    lc2025: localLc2025MapStyle.sources.lc2025,
  },
  layers: [...eoxMapStyle.layers, ...localLc2025MapStyle.layers.slice(localMapStyle.layers.length)],
} satisfies StyleSpecification;

function selectMapStyle(useLocalTiles: boolean, showLc2025Layers: boolean) {
  if (useLocalTiles) {
    return showLc2025Layers ? localLc2025MapStyle : localMapStyle;
  }

  return showLc2025Layers ? eoxLc2025MapStyle : eoxMapStyle;
}

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
  useLocalTiles?: boolean;
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
      mapStyle={selectMapStyle(props.useLocalTiles ?? true, props.showLc2025Layers ?? true)}
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
