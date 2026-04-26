import { makeCard } from "@/lib/cards";

import { ChartCardV2ConfigSchema } from "./config";
import { LiveChart } from "./live-chart";

export const ChartCardV2 = makeCard({
  id: "chart-v2",
  name: "Chart Card V2",
  schema: ChartCardV2ConfigSchema,
  component: (props) => (
    <div className="relative grid h-full min-h-0 w-full min-w-0">
      <LiveChart api={props.api} />
    </div>
  ),
});
