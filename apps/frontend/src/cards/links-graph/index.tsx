import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

export const LinksGraphCard = makeCard({
  id: "links-graph-card",
  name: "Links Graph",
  schema: Schema.Struct({}),
  component: (props) => {
    return <div>Hello World</div>;
  },
});
