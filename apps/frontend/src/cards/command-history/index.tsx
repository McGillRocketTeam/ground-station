import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

export const CommandHistoryCard = makeCard({
  id: "command-history",
  name: "Command History Card",
  schema: Schema.Struct({}),
  actions: () => [
    {
      id: "command-history-actions",
      heading: "Command History",
      actions: [
        {
          id: "refresh-command-history",
          label: "Refresh command History",
          shortcut: "Mod+0",
          run: () => {},
        },
      ],
    },
  ],
  component: () => <div>Hello World!</div>,
});
