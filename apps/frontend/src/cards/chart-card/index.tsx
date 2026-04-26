import { makeCard } from "@/lib/cards";

import { ChartCardConfigSchema } from "./config";
import { LiveChart } from "./live-chart";

export const ChartCard = makeCard({
  id: "chart",
  name: "Chart Card",
  schema: ChartCardConfigSchema,
  component: (props) => (
    <div className="relative grid h-full min-h-0 w-full min-w-0">
      <LiveChart api={props.api} />
    </div>
  ),
});
