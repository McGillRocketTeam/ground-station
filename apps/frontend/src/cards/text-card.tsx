import { makeCard } from "@/lib/cards";
import { Schema } from "effect";

export const TextCard = makeCard({
  id: "text-card",
  name: "Text Card",
  schema: Schema.Struct({ text: Schema.String }),
  component: (props) => <div>{props.text}</div>,
});
