import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

import { CommandHistoryTable } from "./card";

export const CommandHistoryCard = makeCard({
  id: "command-history",
  name: "Command History Card",
  schema: Schema.Struct({}),
  component: CommandHistoryTable,
});
