import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { makeCard } from "@/lib/cards";
import { Schema } from "effect";

export const ParameterCard = makeCard({
  id: "parameter-card",
  name: "Parameter Card",
  schema: Schema.Struct({
    parameter: Schema.String.annotations({
      [FormTitleAnnotationId]: "Parameter Card Field",
      [FormTypeAnnotationId]: "parameter",
    }),
  }),
  component: (props) => <div>{props.parameter}</div>,
});
