import { Schema } from "effect";
import { Suspense, useState } from "react";

import { DashboardMap } from "@/cards/map-card/map";
import { makeCard } from "@/lib/cards";
import { ParameterField } from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId } from "@/lib/form";

import { PredictionAnnotations } from "./prediction-annotations";

const PredictionMapConfiguration = Schema.Struct({
  accuracy: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Predicted Location Accuracy" }),
  ),
  latitude: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Predicted Location Latitude" }),
  ),
  longitude: ParameterField.pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Predicted Location Longitude" }),
  ),
});

function PredictionMap(props: { accuracy: string; latitude: string; longitude: string }) {
  const [viewState, setViewState] = useState({
    longitude: -73.5673,
    latitude: 45.5017,
    zoom: 10,
  });

  return (
    <DashboardMap
      debugName="prediction-map-card"
      viewState={viewState}
      onViewStateChange={setViewState}
    >
      <Suspense>
        <PredictionAnnotations
          accuracy={props.accuracy}
          latitude={props.latitude}
          longitude={props.longitude}
          onInitialCoordinate={(longitude, latitude) => {
            setViewState((current) => ({ ...current, longitude, latitude }));
          }}
        />
      </Suspense>
    </DashboardMap>
  );
}

export const PredictionMapCard = makeCard({
  id: "prediction-map-card",
  name: "Prediction Map Card",
  schema: PredictionMapConfiguration,
  component: (props) => (
    <div className="relative h-full min-h-60 w-full">
      <PredictionMap
        accuracy={props.params.accuracy.qualifiedName}
        latitude={props.params.latitude.qualifiedName}
        longitude={props.params.longitude.qualifiedName}
      />
    </div>
  ),
});
