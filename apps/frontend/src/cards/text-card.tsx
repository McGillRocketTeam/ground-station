import { Schema } from "effect";

import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";

export const TextCard = makeCard({
  id: "text-card",
  name: "Text Card",
  schema: Schema.Struct({
    parameter: Schema.String.pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Parameter Title",
        [FormTypeAnnotationId]: "parameter",
      }),
    ),
    command: Schema.String.pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Command Title",
        [FormTypeAnnotationId]: "command",
      }),
    ),
  }),
  component: (props) => <div>Hello Text Card</div>,
});
