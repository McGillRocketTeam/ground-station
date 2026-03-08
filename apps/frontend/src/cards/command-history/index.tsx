import { Schema } from "effect";

import { makeCard } from "@/lib/cards";


export const CommandHistoryCard = makeCard({
  id: "command-history",
  name: "Command History Card",
  schema: Schema.Struct({}),
  component: () => <div>Hello World!</div>,
});
