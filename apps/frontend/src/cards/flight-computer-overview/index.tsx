import { Schema } from "effect";

import { makeCard } from "@/lib/cards";

export const FlightComputerOverviewCard = makeCard({
  id: "flight-computer-overview",
  name: "FC Overview",
  schema: Schema.Struct({}),
  component: () => <FlightComputerOverview />,
});

function FlightComputerOverview() {
  return (
    <div className="grid w-full grid-cols-2">
      <div>
        <div className="w-full border-r p-1 text-center font-mono uppercase">
          System A
        </div>

        <div className="grid grid-cols-6 gap-px bg-muted font-mono text-sm text-muted-foreground uppercase *:px-1 *:text-center">
          <div className="col-span-full text-primary">F/DOV</div>
          <div className="col-span-3 bg-background">Logical Arm</div>
          <div className="col-span-3 bg-background">Electrical Arm</div>
          <div className="col-span-2 bg-background">Gate</div>
          <div className="col-span-2 bg-background">Current</div>
          <div className="col-span-2 bg-background">Continuity</div>
        </div>
      </div>
      <div>
        <div className="w-full p-1 text-center font-mono uppercase">
          System B
        </div>
      </div>
    </div>
  );
}
