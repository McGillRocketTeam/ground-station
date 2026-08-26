import type { StyleSpecification } from "maplibre-gl";

export function resolveMbtileserverBaseUrl() {
  const url = new URL("http://localhost:3001/services");

  if (
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    url.hostname = window.location.hostname;
  }

  return url.toString().replace(/\/$/, "");
}

const mbtileserverBaseUrl = resolveMbtileserverBaseUrl();
const regionBounds: [number, number, number, number] = [
  -82.015314, 47.750009, -81.500004, 48.250009,
];
const rasterPaint = {
  "raster-opacity": 1,
  "raster-fade-duration": 0,
} as const;

export const localMapStyle = {
  name: "LC2025 Offline Map",
  version: 8,
  sources: {
    regionSatellite: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/region-satellite-z0-z16/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: regionBounds,
      minzoom: 0,
      maxzoom: 16,
    },
    detail5km: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/detail-5km-z17-z18/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-81.90717164342442, 47.943439327169, -81.84001533233814, 47.98840534535523],
      minzoom: 17,
      maxzoom: 18,
    },
    detail1km: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/detail-1km-z19-z21/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-81.88030911898991, 47.9614257344435, -81.86687785677265, 47.97041893808074],
      minzoom: 19,
      maxzoom: 21,
    },
    lc2025: {
      type: "vector",
      tiles: [`${mbtileserverBaseUrl}/lc2025/tiles/{z}/{x}/{y}.pbf`],
      bounds: regionBounds,
      minzoom: 8,
      maxzoom: 16,
    },
    lc2025Boundary: {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-82.015314, 47.750009],
              [-81.500004, 47.750009],
              [-81.500004, 48.250009],
              [-82.015314, 48.250009],
              [-82.015314, 47.750009],
            ],
          ],
        },
      },
    },
  },
  layers: [
    {
      id: "region-satellite",
      type: "raster",
      source: "regionSatellite",
      paint: rasterPaint,
    },
    {
      id: "detail-5km",
      type: "raster",
      source: "detail5km",
      minzoom: 13.5,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14, 1],
        "raster-fade-duration": 0,
      },
    },
    {
      id: "detail-1km",
      type: "raster",
      source: "detail1km",
      minzoom: 18,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 18, 0, 19, 1],
        "raster-fade-duration": 0,
      },
    },
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
    {
      id: "lc2025-boundary",
      type: "line",
      source: "lc2025Boundary",
      paint: {
        "line-color": "#9ca3af",
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 16, 3],
      },
    },
  ],
} satisfies StyleSpecification;

export const localSatelliteMapStyle = {
  name: "LC2025 Offline Satellite",
  version: 8,
  sources: {
    regionSatellite: localMapStyle.sources.regionSatellite,
    detail5km: localMapStyle.sources.detail5km,
    detail1km: localMapStyle.sources.detail1km,
    lc2025Boundary: localMapStyle.sources.lc2025Boundary,
  },
  layers: [
    ...localMapStyle.layers.slice(0, 3),
    {
      id: "lc2025-boundary",
      type: "line",
      source: "lc2025Boundary",
      paint: {
        "line-color": "#9ca3af",
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 16, 3],
      },
    },
  ],
} satisfies StyleSpecification;
