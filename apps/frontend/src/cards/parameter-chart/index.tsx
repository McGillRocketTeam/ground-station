import { makeCard } from "@/lib/cards";
import { Schema } from "effect";
import { ParameterChart } from "./chart";

export const ParameterChartCard = makeCard({
  id: "parameter-chart",
  name: "Parameter Chart Card",
  schema: Schema.Struct({}),
  component: () => (
    <div className="grid place-items-center">
      <ParameterChart />
    </div>
  ),
});
