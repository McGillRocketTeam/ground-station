import { Schema } from "effect";

import { ScrollArea } from "@/components/ui/scroll-area";
import { makeCard } from "@/lib/cards";

import { CommandHistoryTable } from "./card";

export const CommandHistoryCard = makeCard({
  id: "command-history",
  name: "Command History Card",
  schema: Schema.Struct({}),
  component: () => (
    <ScrollArea className="h-full">
      <CommandHistoryTable />
    </ScrollArea>
  ),
});
