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
            component: "parameter-table",
            id: crypto.randomUUID(),
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
