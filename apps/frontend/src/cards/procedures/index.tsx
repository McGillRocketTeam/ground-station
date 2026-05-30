import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

export const TextCard = makeCard({
  id: "procedures-card",
  name: "Procedures Card",
  schema: Schema.Struct({}),
  component: () => <div>Hello Text Card</div>,
});
