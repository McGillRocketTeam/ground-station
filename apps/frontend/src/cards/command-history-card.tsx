import { makeCard } from "@/lib/cards";
import { Schema } from "effect";

export const ParameterCard = makeCard({
  id: "command-history-card",
  name: "Command History Card",
  schema: Schema.Struct({}),
  component: (props) => <div>Command History</div>,
});
