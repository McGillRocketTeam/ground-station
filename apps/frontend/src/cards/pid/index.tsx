import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

import { PIDDiagram } from "./gojs";

export const PIDCard = makeCard({
  id: "pid-card",
  name: "P&ID Card",
  schema: Schema.Struct({}),
  component: () => (
    <div className="grid w-full h-full place-items-center">
      <PIDDiagram />
    </div>
  ),
});
