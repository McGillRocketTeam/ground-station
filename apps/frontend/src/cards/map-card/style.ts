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

const requiredTilesets = [
  "worldLowQuality",
  "satellite-2017-11-02_canada_ontario",
  "launchcanada",
  "launchcanada2",
  "timminsCity",
] as const;

const rasterPaint = {
  "raster-opacity": 1,
  "raster-fade-duration": 0,
} as const;

export const eoxMapStyle = {
  name: "EOX Sentinel-2 Cloudless 2025",
  version: 8,
  sources: {
    eoxSatellite: {
      type: "raster",
      tiles: [
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: "EOX-Satellite",
      type: "raster",
      source: "eoxSatellite",
      paint: rasterPaint,
    },
  ],
} satisfies StyleSpecification;

export const localMapStyle = {
  name: "Local Satellite",
  version: 8,
  sources: {
    worldLowQuality: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/worldLowQuality/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-165.219, -88.6959, 178.999, 88.5106],
      minzoom: 0,
      maxzoom: 6,
    },
    ontario: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/satellite-2017-11-02_canada_ontario/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-95.15965, 41.6377, -74.30998, 57.50826],
      minzoom: 0,
      maxzoom: 13,
    },
    launchCanadaRegional: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/launchcanada/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-84.4429, 46.535, -79.3033, 49.358],
      minzoom: 12,
      maxzoom: 15,
    },
    launchCanadaDetail: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/launchcanada2/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-82.0236, 47.8831, -81.7227, 48.0483],
      minzoom: 0,
      maxzoom: 18,
    },
    timminsCity: {
      type: "raster",
      tiles: [`${mbtileserverBaseUrl}/timminsCity/tiles/{z}/{x}/{y}.jpg`],
      tileSize: 256,
      bounds: [-81.511, 48.3795, -81.1542, 48.5736],
      minzoom: 12,
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: "World-Low-Quality",
      type: "raster",
      source: "worldLowQuality",
      minzoom: 0,
      paint: rasterPaint,
    },
    {
      id: "Ontario-Satellite",
      type: "raster",
      source: "ontario",
      minzoom: 3,
      paint: rasterPaint,
    },
    {
      id: "Launch-Canada-Regional",
      type: "raster",
      source: "launchCanadaRegional",
      minzoom: 12,
      paint: rasterPaint,
    },
    {
      id: "Launch-Canada-Detail",
      type: "raster",
      source: "launchCanadaDetail",
      minzoom: 15,
      paint: rasterPaint,
    },
    {
      id: "Timmins-City",
      type: "raster",
      source: "timminsCity",
      minzoom: 12,
      paint: rasterPaint,
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

  return tileChecks.every((result) => result.status === "fulfilled" && result.value);
}
