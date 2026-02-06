import {
  DockviewApi,
  DockviewReact,
  themeAbyssSpaced,
  type DockviewReadyEvent,
  type SerializedDockview,
} from "dockview-react";

import { DashboardPlus } from "@/components/dashboard/dashboard-plus";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import { CardComponentMap } from "@/lib/cards";
import { formatDate } from "@/lib/utils";
import { Atom, useAtom, useAtomSuspense } from "@effect-atom/atom-react";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { timeSubscriptionAtom } from "@mrt/yamcs-atom";
import { Schema } from "effect";
import { Suspense, useEffect, useState } from "react";
import "./dashboard.css";

function Time() {
  const { value: time } = useAtomSuspense(timeSubscriptionAtom).value;

  return formatDate(time);
}

function MissionTime() {
  return (
    <div className="flex flex-col border font-mono text-xs">
      <div className="bg-border text-muted-foreground w-full text-center font-semibold">
        MISSION TIME
      </div>

      <div className="text-orange-text w-[16.5ch] text-center text-xs">
        <Suspense fallback="LOADING">
          <Time />
        </Suspense>
      </div>
    </div>
  );
}

const runtime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage);

const dashboardLocalStorage = Atom.kvs({
  runtime: runtime,
  key: "mrt-dashboard",
  schema: Schema.Object,
  defaultValue: () => ({}),
});

export function DashboardPage() {
  const [api, setApi] = useState<DockviewApi>();
  const [layout, setLayout] = useAtom(dashboardLocalStorage);

  useEffect(() => {
    if (!api) {
      return;
    }

    const disposable = api.onDidLayoutChange(() => {
      const layout: SerializedDockview = api.toJSON();
      setLayout(layout);
    });

    return () => disposable.dispose();
  }, [api]);

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event.api);

    try {
      event.api.fromJSON(layout as SerializedDockview);
    } catch (err) {
      console.error("Error loading layout", err);

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
      event.api.addPanel({
        title: "Command Buttons",
        component: "command-button",
        id: crypto.randomUUID(),
      });
    }
  };

  return (
    <div className="fixed flex h-full w-full flex-col gap-1.25 p-1.25">
      <div className="flex flex-row justify-between">
        <div className="flex flex-col font-mono text-xs uppercase">
          <div className="text-mrt">McGill Rocket Team</div>
          <div className="text-muted-foreground">Ground Station Controls</div>
        </div>
        <MissionTime />
      </div>
      <div className="grow">
        <DockviewReact
          onReady={onReady}
          theme={{ ...themeAbyssSpaced, gap: 5 }}
          components={CardComponentMap}
          leftHeaderActionsComponent={DashboardPlus}
          defaultTabComponent={DashboardTab}
        />
      </div>
    </div>
  );
}
