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
