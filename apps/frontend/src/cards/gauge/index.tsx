import { makeCard } from "@/lib/cards";

import { DEFAULT_VISUAL_RANGES, GaugeCardConfigSchema } from "./config";
import { Gauge } from "./gauge";

export const GaugeCard = makeCard({
  id: "gauge",
  name: "Gauge Card",
  schema: GaugeCardConfigSchema,
  component: () => (
    <div className="relative grid h-full w-full place-items-center">
      <Gauge ranges={DEFAULT_VISUAL_RANGES} />
    </div>
  ),
});
