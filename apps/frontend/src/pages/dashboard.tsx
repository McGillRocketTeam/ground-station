import { DockviewReact, themeAbyssSpaced } from "dockview-react";

import "./dashboard.css";
import { DashboardPlus } from "@/components/dashboard/dashboard-plus";
import { CardComponentMap } from "@/lib/cards";

export function DashboardPage() {
  return (
    <div className="fixed h-full w-full">
      <DockviewReact
        onReady={(event) => {
          event.api.addPanel({
            title: "Parameter Table",
            component: "parameter-table",
            id: crypto.randomUUID(),
          });
          event.api.addPanel({
            title: "Command History",
            component: "command-history",
            id: crypto.randomUUID(),
          });
          event.api.addPanel({
            title: "Parameter Chart",
            component: "parameter-chart",
            id: crypto.randomUUID(),
          });
          event.api.addPanel({
            title: "Events",
            component: "events",
            id: crypto.randomUUID(),
          });
          event.api.addPanel({
            title: "Links",
            component: "links",
            id: crypto.randomUUID(),
          });
        }}
        theme={{ ...themeAbyssSpaced, gap: 5 }}
        components={CardComponentMap}
        leftHeaderActionsComponent={DashboardPlus}
        // defaultTabComponent={DashboardTab}
      />
    </div>
  );
}
