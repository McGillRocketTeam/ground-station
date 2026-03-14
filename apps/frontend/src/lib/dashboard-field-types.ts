import { Schema } from "effect";

import {
  FormMaxAnnotationId,
  FormMinAnnotationId,
  FormTitleAnnotationId,
  FormTypeAnnotationId,
} from "./form";

export const ParameterField = Schema.Struct({
  qualifiedName: Schema.String,
}).pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Parameter",
    [FormTypeAnnotationId]: "parameter",
  }),
);

export const CoordinateLongitudeField = Schema.NumberFromString.pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Longitude",
    [FormTypeAnnotationId]: "coordinate",
    [FormMinAnnotationId]: -180,
    [FormMaxAnnotationId]: 180,
  }),
);

export const CoordinateLatitudeField = Schema.NumberFromString.pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Latitude",
    [FormTypeAnnotationId]: "coordinate",
    [FormMinAnnotationId]: -90,
    [FormMaxAnnotationId]: 90,
  }),
);
