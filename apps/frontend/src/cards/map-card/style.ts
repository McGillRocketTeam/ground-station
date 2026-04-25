import type { StyleSpecification } from "maplibre-gl";

const mbtileserverBaseUrl = "http://localhost:3001/services";

const requiredTilesets = [
  "worldLowQuality",
  "satellite-2017-11-02_canada_ontario",
  "timminsCity",
  "launchcanada",
  "launchcanada2",
] as const;

export const basicMapStyle = (theme: string) =>
  theme === "dark"
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

export const customMapStyle = {
  name: "OSM + Satellite",
  version: 8,
  sources: {
    worldLowQuality: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/worldLowQuality/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-165.219, -88.6959, 178.999, 88.5106],
    },
    ontarioFull: {
      type: "raster",
      tiles: [
        `${mbtileserverBaseUrl}/satellite-2017-11-02_canada_ontario/tiles/{z}/{x}/{y}.jpg`,
      ],
      tileSize: 256,
      bounds: [-95.15965, 41.6377, -74.30998, 57.50826],
    },
    timminsCity: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/timminsCity/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-81.511, 48.3795, -81.1542, 48.5736],
    },
    launchCanada1: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/launchcanada/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-84.4429, 46.535, -79.3033, 49.358],
      minzoom: 0,
      maxzoom: 13,
    },
    launchCanada2: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/launchcanada2/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-82.0236, 47.8831, -81.7227, 48.0483],
      minzoom: 0,
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: "World-Low-Quality",
      type: "raster",
      source: "worldLowQuality",
      minzoom: 0,
      maxzoom: 8,
      layout: {
        visibility: "visible",
      },
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
      },
      filter: ["all"],
    },
    {
      id: "Ontario-Full",
      type: "raster",
      source: "ontarioFull",
      minzoom: 4,
      maxzoom: 22,
      layout: {
        visibility: "visible",
      },
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
      },
      filter: ["all"],
    },
    {
      id: "Launch-Canada-1",
      type: "raster",
      source: "launchCanada1",
      minzoom: 0,
      maxzoom: 15,
      layout: {
        visibility: "visible",
      },
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
      },
      filter: ["all"],
    },
    {
      id: "Launch-Canada-2",
      type: "raster",
      source: "launchCanada2",
      minzoom: 15,
      maxzoom: 22,
      layout: {
        visibility: "visible",
      },
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
      },
      filter: ["all"],
    },
    {
      id: "Timmins-City",
      type: "raster",
      source: "timminsCity",
      minzoom: 12,
      maxzoom: 22,
      layout: {
        visibility: "visible",
      },
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
      },
      filter: ["all"],
    },
  ],
} satisfies StyleSpecification;

export async function hasLocalMapTiles(): Promise<boolean> {
  const tileChecks = await Promise.allSettled(
    requiredTilesets.map(async (tilesetId) => {
      const response = await fetch(`${mbtileserverBaseUrl}/${tilesetId}`, {
        cache: "no-store",
      });

      return response.ok;
    }),
  );

  return tileChecks.every(
    (result) => result.status === "fulfilled" && result.value,
  );
}
