import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

export const ProceduresCard = makeCard({
  id: "procedures-card",
  name: "Procedures Card",
  schema: Schema.Struct({}),
  component: () => <div>Hello Text Card</div>,
});
