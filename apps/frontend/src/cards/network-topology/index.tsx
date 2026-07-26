import { Schema } from "effect";

import { ScrollArea } from "@/components/ui/scroll-area";
import { makeCard } from "@/lib/cards";

import { AntennasModule } from "./antennas";
import "./index.css";
import { RouterModule } from "./router";
import { TrafficModule } from "./traffic";

export const NetworkTopologyCard = makeCard({
  id: "network-topology",
  name: "Network Topology",
  schema: Schema.Struct({}),
  component: () => (
    <ScrollArea className="network-topology h-full bg-background font-mono text-sm text-foreground">
      <div className="network-topology__grid">
        <RouterModule />
        <TrafficModule />
        <AntennasModule />
      </div>
    </ScrollArea>
  ),
});
