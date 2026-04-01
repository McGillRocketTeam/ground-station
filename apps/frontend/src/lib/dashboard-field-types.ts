import { NamedObjectId } from "@mrt/yamcs-effect";
import { Schema } from "effect";

import { FormTitleAnnotationId, FormTypeAnnotationId } from "./form";

export const ParameterField = Schema.Struct({
  qualifiedName: Schema.String,
}).pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Parameter",
    [FormTypeAnnotationId]: "parameter",
  }),
);

export const ParameterArrayField = Schema.Array(
  Schema.Struct({ NamedObjectId }),
).pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Parameters",
    [FormTypeAnnotationId]: "parameterArray",
  }),
);
