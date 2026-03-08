import { useAtom, useAtomSet, useAtomSuspense } from "@effect/atom-react";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import {
  DockviewReact,
  themeAbyssSpaced,
  type DockviewReadyEvent,
  type SerializedDockview,
} from "dockview-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Suspense, useEffect } from "react";

import { DashboardCommandMenu } from "@/components/dashboard/dashboard-command";
import { DashboardKeybinds } from "@/components/dashboard/dashboard-keybinds";
import {
  dashboardDockviewApiAtom,
  initializeDashboardLayoutHistoryAtom,
  pushDashboardLayoutHistoryAtom,
} from "@/components/dashboard/dashboard-layout";
import { DashboardMenuBar } from "@/components/dashboard/dashboard-menubar";
import { DashboardPlus } from "@/components/dashboard/dashboard-plus";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";

import "./dashboard.css";
import { EditDialogPanel as EditPanelDialog } from "@/components/dashboard/edit-panel-dialog";
import { timeSubscriptionAtom } from "@/lib/atom";
import { CardComponentMap } from "@/lib/cards";
import { formatDate } from "@/lib/utils";

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
  schema: Schema.ObjectKeyword,
  defaultValue: () => ({}),
});

export function DashboardPage() {
  const [api, setApi] = useAtom(dashboardDockviewApiAtom);
  const [layout, setLayout] = useAtom(dashboardLocalStorage);
  const initializeDashboardLayoutHistory = useAtomSet(
    initializeDashboardLayoutHistoryAtom,
  );
  const pushDashboardLayoutHistory = useAtomSet(pushDashboardLayoutHistoryAtom);

  useEffect(() => {
    if (!api) {
      return;
    }

    const disposable = api.onDidLayoutChange(() => {
      const layout: SerializedDockview = api.toJSON();
      setLayout(layout);
      pushDashboardLayoutHistory(layout);
    });

    return () => disposable.dispose();
  }, [api, pushDashboardLayoutHistory, setLayout]);

  useEffect(
    () => () => {
      setApi(undefined);
    },
    [setApi],
  );

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
      // event.api.addPanel({
      //   title: "Command History",
      //   component: "command-history",
      //   id: crypto.randomUUID(),
      // });
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

    const initialLayout = event.api.toJSON();
    setLayout(initialLayout);
    initializeDashboardLayoutHistory(initialLayout);
  };

  return (
    <div className="fixed flex h-full w-full flex-col p-1.25">
      <div className="flex flex-row justify-between">
        <div className="flex flex-col font-mono text-xs uppercase items-start">
          <div className="text-mrt">McGill Rocket Team</div>
          <div className="text-muted-foreground">Ground Station Controls</div>
        </div>
        <MissionTime />
      </div>
      <EditPanelDialog />
      <DashboardCommandMenu />
      <DashboardKeybinds />
      <DashboardMenuBar />
      <div className="grow pt-1.25">
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
