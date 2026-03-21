import { makeCard } from "@/lib/cards";
import { Schema } from "effect";
import { PID } from "./pid"; // Your SVG component

export const PIDCard = makeCard({
  id: "pid",
  name: "PID Card",
  schema: Schema.Struct({}),
  component: () => {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <PID />
      </div>
    );
  },
});