import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

import { ParameterChart } from "./chart";

export const ParameterChartCard = makeCard({
  id: "parameter-chart",
  name: "Parameter Chart Card",
  schema: Schema.Struct({}),
  component: () => (
    <div className="relative grid h-full w-full">
      <ParameterChart />
    </div>
  ),
});
