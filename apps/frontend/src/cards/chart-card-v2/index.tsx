import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

import { LiveChart } from "./live-chart";

export const ChartCardV2 = makeCard({
  id: "chart-v2",
  name: "Chart Card V2",
  schema: Schema.Struct({}),
  component: (props) => (
    <div className="relative grid h-full min-h-0 w-full min-w-0">
      <LiveChart api={props.api} />
    </div>
  ),
});
