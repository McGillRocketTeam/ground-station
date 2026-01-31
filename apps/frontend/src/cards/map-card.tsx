import maplibregl, { Marker, NavigationControl } from "maplibre-gl";
import type { IDockviewPanelProps } from "dockview-react";
import "maplibre-gl/dist/maplibre-gl.css";

import { useAtomSuspense } from "@effect-atom/atom-react";
import { makeCard } from "@/lib/cards";
import { Schema } from "effect";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import type { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import type { QualifiedName } from "@mrt/yamcs-effect";
import { useEffect, useRef } from "react";

const MapCardConfiguration = Schema.TaggedStruct("MapCard", {
  long: Schema.Number.pipe(
    Schema.greaterThan(-180),
    Schema.lessThan(180),
    Schema.annotations({ title: "Longitude" }),
  ),
  lat: Schema.Number.pipe(
    Schema.greaterThan(-90),
    Schema.lessThan(90),
    Schema.annotations({ title: "Latitude" }),
  ),
  trackerLong: Schema.optional(Schema.String.annotations({ title: "YAMCS Longitude" })),
  trackerLat: Schema.optional(Schema.String.annotations({ title: "YAMCS Latitude" })),
})

export const MapCard = makeCard({
  id: "map-card",
  name: "Map Card",
  schema: MapCardConfiguration,
  component: MapCardComponent,
});


function MapCardComponent(
  props: IDockviewPanelProps<typeof MapCardConfiguration.Type>,
) {
  const {
    long,
    lat,
    trackerLong,
    trackerLat,
  } = props.params;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // normalize numeric params: inputs may be strings from saved configs or the form
  const toNumber = (v: any) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const longitude = toNumber(long) ?? 0;
  const latitude = toNumber(lat) ?? 0;

  const mapStyleUrl =
    "https://api.maptiler.com/maps/streets/style.json?key=T3tvaasfaJA1424bXIt6";

  useEffect(() => {
    if (!mapContainer.current) return;

    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: [longitude, latitude],
      zoom: 10,
    });

    // Add navigation control
    map.current.addControl(new NavigationControl(), "top-left");

    return () => {
      // Cleanup on unmount
    };
  }, [longitude, latitude, mapStyleUrl]);

  // Update marker when coordinates change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    document.querySelectorAll("[data-marker-id='parameter-marker']").forEach((el) => {
      el.remove();
    });

    // Add new marker if both tracker coordinates are available
    if (trackerLat && trackerLong) {
      const trackerLatNum = parseFloat(String(trackerLat));
      const trackerLongNum = parseFloat(String(trackerLong));
      
      if (Number.isFinite(trackerLatNum) && Number.isFinite(trackerLongNum)) {
        
        new Marker().setLngLat([trackerLongNum, trackerLatNum]).addTo(map.current);
      }
    }
  }, [trackerLat, trackerLong]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 300 }}>
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};



function ParameterMarker({ latParamName, longParamName }: { latParamName: QualifiedName; longParamName: QualifiedName }) {
  const latUpdate = useAtomSuspense(parameterSubscriptionAtom(latParamName)).value;
  const longUpdate = useAtomSuspense(parameterSubscriptionAtom(longParamName)).value;

  const parseNumber = (paramValue: any): number | undefined => {
    if (!paramValue) return undefined;
    const v = paramValue.endValue;
    if (v == null) return undefined;
    const candidate = (v as any).value ?? (v as any).raw ?? v;
    const n = Number(candidate);
    return Number.isFinite(n) ? n : undefined;
  };
  const lat = parseNumber(latUpdate);
  const longitude = parseNumber(longUpdate);

  // If we couldn't parse numeric coordinates, don't render the marker
  if (lat === undefined || longitude === undefined) return null;

  return <Marker longitude={longitude} latitude={lat} color="red" />;
}