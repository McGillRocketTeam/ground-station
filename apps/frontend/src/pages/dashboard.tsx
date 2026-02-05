import { DockviewReact, themeAbyssSpaced } from "dockview-react";

import "./dashboard.css";
import { DashboardPlus } from "@/components/dashboard/dashboard-plus";
import { CardComponentMap } from "@/lib/cards";
import { useAtomSuspense } from "@effect-atom/atom-react";
import { timeSubscriptionAtom } from "@mrt/yamcs-atom";
import { Suspense } from "react";
import { formatDate } from "@/lib/utils";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";

function MissionTime() {
  return (
    <div className="border flex flex-col text-xs font-mono">
      <div className="bg-border w-full text-center text-muted-foreground font-semibold">
        MISSION TIME
      </div>

      <div className="text-xs text-center w-[16.5ch] text-orange-text">
        <Suspense fallback="LOADING">
          <Time />
        </Suspense>
      </div>
    </div>
  );

  function Time() {
    const { value: time } = useAtomSuspense(timeSubscriptionAtom).value;

    return formatDate(time);
  }
}

export function DashboardPage() {
  return (
    <div className="fixed w-full h-full flex flex-col p-1.25 gap-1.25">
      <div className="flex flex-row justify-between">
        <div className="flex flex-col text-xs font-mono uppercase">
          <div className="text-mrt">McGill Rocket Team</div>
          <div className="text-muted-foreground">Ground Station Controls</div>
        </div>
        <MissionTime />
      </div>
      <div className="grow">
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
          defaultTabComponent={DashboardTab}
        />
      </div>
    </div>
  );
}
