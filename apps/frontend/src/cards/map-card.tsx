import { Schema } from "effect";
import { useEffect, useState } from "react";
import { Map, Marker, NavigationControl } from "react-map-gl/maplibre";

import { Button } from "@/components/ui/button";
import { makeCard } from "@/lib/cards";
import {
  CoordinateLatitudeField,
  CoordinateLongitudeField,
} from "@/lib/dashboard-field-types";
import "maplibre-gl/dist/maplibre-gl.css";

const MapCardConfiguration = Schema.Struct({
  longitude: CoordinateLongitudeField,
  latitude: CoordinateLatitudeField,
});

export const MapCard = makeCard({
  id: "map-card",
  name: "Map Card",
  schema: MapCardConfiguration,
  component: (props) => {
    const longitude = Number(props.params.longitude);
    const latitude = Number(props.params.latitude);
    const [isCameraLocked, setIsCameraLocked] = useState(false);
    const [viewState, setViewState] = useState({
      longitude,
      latitude,
      zoom: 12,
    });

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
      <div className="relative h-full w-full min-h-60">
        <div className="absolute top-2 right-2 z-10">
          <Button size="sm" variant="secondary" onClick={toggleCameraLock}>
            {isCameraLocked ? "Unlock Camera" : "Lock & Recenter"}
          </Button>
        </div>
        <Map
          mapStyle={{
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
          }}
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
        </Map>
      </div>
    );
  },
});
