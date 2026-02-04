import { makeCard } from "@/lib/cards";
import { Schema } from "effect";

export const LinksCard = makeCard({
  id: "links",
  name: "Links Card",
  schema: Schema.Struct({}),
  component: () => <div className="relative grid w-full h-full">links</div>,
});
