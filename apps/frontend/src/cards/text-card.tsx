import { Schema } from "effect";

import { makeCard } from "@/lib/cards";
import { ParameterField } from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";

export const TextCard = makeCard({
  id: "text-card",
  name: "Text Card",
  schema: Schema.Struct({
    parameter: ParameterField,
    command: Schema.String.pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Command Title",
        [FormTypeAnnotationId]: "command",
      }),
    ),
  }),
  component: () => <div>Hello Text Card</div>,
});
