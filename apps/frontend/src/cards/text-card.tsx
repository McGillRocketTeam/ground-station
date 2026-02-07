import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { Schema } from "effect";

export const TextCard = makeCard({
  id: "text-card",
  name: "Text Card",
  schema: Schema.Struct({
    parameter: Schema.String.annotations({
      [FormTitleAnnotationId]: "Parameter Title",
      [FormTypeAnnotationId]: "parameter",
    }),
    command: Schema.String.annotations({
      [FormTitleAnnotationId]: "Command Title",
      [FormTypeAnnotationId]: "command",
    }),
  }),
  component: (props) => <div>Hello Text Card</div>,
});
