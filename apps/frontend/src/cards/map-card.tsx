import { Schema } from "effect";
import { Suspense, useEffect, useState } from "react";
import { Map, Marker, NavigationControl } from "react-map-gl/maplibre";

import { resolveTheme, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { makeCard } from "@/lib/cards";
import {
  CoordinateLatitudeField,
  CoordinateLongitudeField,
  ParameterField,
} from "@/lib/dashboard-field-types";
import "maplibre-gl/dist/maplibre-gl.css";
import { FormTitleAnnotationId } from "@/lib/form";
import { useAtomSuspense } from "@effect/atom-react";
import { parameterSubscriptionAtom } from "@/lib/atom";

const MapCardConfiguration = Schema.Struct({
  longitude: CoordinateLongitudeField,
  latitude: CoordinateLatitudeField,
  
  altitude: ParameterField.pipe(Schema.annotate({[FormTitleAnnotationId]: "Rocket Altitude"})),
  rocketLat: ParameterField.pipe(Schema.annotate({[FormTitleAnnotationId]: "Rocket Latitude"})),
  rocketLong: ParameterField.pipe(Schema.annotate({[FormTitleAnnotationId]: "Rocket Longitude"}))
});

const lightMapStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
} as const;

const darkMapStyle = {
  version: 8,
  sources: {
    dark: {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "dark",
      type: "raster",
      source: "dark",
      paint: {
        "raster-brightness-min": 0.35,
        "raster-brightness-max": 1,
        "raster-contrast": -0.1,
        "raster-saturation": -0.15,
      },
    },
  ],
} as const;

export function RocketMarker(props: { lat: string; long: string }) {
  const latValue = useAtomSuspense(parameterSubscriptionAtom(props.lat)).value.engValue;
  const longValue = useAtomSuspense(parameterSubscriptionAtom(props.long)).value.engValue;

  if (latValue.type === "FLOAT" && longValue.type === "FLOAT") {
    return <Marker longitude={Number(longValue)} latitude={Number(latValue.value)} color="blue" />;
  }

}


export const MapCard = makeCard({
  id: "map-card",
  name: "Map Card",
  schema: MapCardConfiguration,
  component: (props) => {
    const { theme } = useTheme();
    const longitude = Number(props.params.longitude);
    const latitude = Number(props.params.latitude);
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
      resolveTheme(theme),
    );
    const mapStyle = resolvedTheme === "dark" ? darkMapStyle : lightMapStyle;
    const [isCameraLocked, setIsCameraLocked] = useState(false);
    const [viewState, setViewState] = useState({
      longitude,
      latitude,
      zoom: 12,
    });

    useEffect(() => {
      if (theme !== "system") {
        setResolvedTheme(resolveTheme(theme));
        return;
      }

      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        setResolvedTheme(media.matches ? "dark" : "light");
      };

      apply();
      media.addEventListener("change", apply);

      return () => {
        media.removeEventListener("change", apply);
      };
    }, [theme]);

    useEffect(() => {
      setViewState((previous) => ({
        ...previous,
        longitude,
        latitude,
      }));
    }, [latitude, longitude]);

    const toggleCameraLock = () => {
      setIsCameraLocked((previous) => {
        const next = !previous;

        if (next) {
          setViewState((current) => ({
            ...current,
            longitude,
            latitude,
          }));
        }

        return next;
      });
    };

    return (
      <div className="relative h-full min-h-60 w-full">
        <div className="absolute top-2 right-2 z-10">
          <Button size="sm" variant="secondary" onClick={toggleCameraLock}>
            {isCameraLocked ? "Unlock Camera" : "Lock & Recenter"}
          </Button>
        </div>
        <Map
          mapStyle={mapStyle}
          {...viewState}
          onMove={(event) => {
            if (isCameraLocked) {
              setViewState({
                ...event.viewState,
                longitude,
                latitude,
              });
              return;
            }

            setViewState(event.viewState);
          }}
          scrollZoom
          dragPan={!isCameraLocked}
          dragRotate
          doubleClickZoom
          touchZoomRotate
          keyboard
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-left" />
          <Marker longitude={longitude} latitude={latitude} color="red" />
          <Suspense>
            <RocketMarker lat={props.params.rocketLat.qualifiedName} long={props.params.rocketLong.qualifiedName} />
          </Suspense>
        </Map>
      </div>
    );
  },
});
