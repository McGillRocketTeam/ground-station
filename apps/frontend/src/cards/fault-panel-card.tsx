import { Schema } from "effect";

import { makeCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

const faults = [
  "VENT\nENERGIZED",
  "F/DOV\nENERGIZED",
  "MOV\nARMED",
  "FC A\nLINK LOST",
  "VENT\nFAILURE",
  "F/DOV\nFAILURE",
  "MOV\nFAILURE",
  "FC B\nLINK LOST",
  "DROGUE\nARMED",
  "MAIN\nARMED",
  "GPS\nLOCKED",
  "LABJACK\nLINK LOST",
  "DROGUE\nFAILURE",
  "MAIN\nFAILURE",
  "GPS\nFAILURE",
  "LAUNCH PAD\nLINK LOST",
];

export const FaultPanelCard = makeCard({
  id: "fault-panel-card",
  name: "Fault Panel Card",
  schema: Schema.Struct({}),
  component: () => (
    <div className="grid grid-cols-4">
      {faults.map((f) => (
        <Fault key={f} name={f} />
      ))}
    </div>
  ),
});

type Status = "success" | "error" | "warning" | "none";

function isIlluminated(name: string) {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10;
  }

  return hash === 0;
}

function Fault({ name }: { name: string }) {
  const illuminated = isIlluminated(name);
  const status: Status = name.includes("ENERGIZED")
    ? "success"
    : name.includes("ARMED")
      ? "warning"
      : "error";

  return (
    <button
      type="button"
      data-illuminated={illuminated}
      className={cn(
        "whitespace-pre-line text-border border text-center grid place-items-center font-mono py-1",
        status === "success" && "data-[illuminated=true]:text-success",
        status === "error" && "data-[illuminated=true]:text-error",
        status === "warning" && "data-[illuminated=true]:text-warning",
      )}
    >
      {name}
    </button>
  );
}
