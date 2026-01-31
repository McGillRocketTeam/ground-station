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
            title: "My Card Title",
            component: "map-card",
            id: crypto.randomUUID(),
            params: {
              long: -74.006,
              lat: 45,
              trackerLong: -74.006,
              trackerLat: 40.7128,
            }
          });
        }}
        theme={themeAbyssSpaced}
        components={CardComponentMap}
        leftHeaderActionsComponent={DashboardPlus}
        // defaultTabComponent={DashboardTab}
      />
    </div>
  );
}
