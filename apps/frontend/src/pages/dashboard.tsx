import { useAtom, useAtomSet } from "@effect/atom-react";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import {
  DockviewReact,
  themeAbyssSpaced,
  type DockviewReadyEvent,
  type SerializedDockview,
} from "dockview-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";

import { DashboardCommandMenu } from "@/components/dashboard/dashboard-command";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardKeybinds } from "@/components/dashboard/dashboard-keybinds";
import {
  dashboardDockviewApiAtom,
  initializeDashboardLayoutHistoryAtom,
  pushDashboardLayoutHistoryAtom,
} from "@/components/dashboard/dashboard-layout";
import { DashboardMenuBar } from "@/components/dashboard/dashboard-menubar";
import { DashboardPlus } from "@/components/dashboard/dashboard-plus";

import "./dashboard.css";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import { EditDialogPanel as EditPanelDialog } from "@/components/dashboard/edit-panel-dialog";
import { CardComponentMap } from "@/lib/cards";

const runtime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage);
const dashboardStorageKey = "mrt-dashboard";

const dashboardLocalStorage = Atom.kvs({
  runtime: runtime,
  key: dashboardStorageKey,
  schema: Schema.ObjectKeyword,
  defaultValue: () => ({}),
});

function isSerializedDockviewLayout(
  layout: unknown,
): layout is SerializedDockview {
  return (
    typeof layout === "object" &&
    layout !== null &&
    Object.keys(layout).length > 0
  );
}

function snapshotDockviewLayout(
  layout: SerializedDockview,
): SerializedDockview {
  return structuredClone(layout);
}

function persistDashboardLayout(layout: SerializedDockview) {
  window.localStorage.setItem(dashboardStorageKey, JSON.stringify(layout));
}

function readPersistedDashboardLayout() {
  const rawLayout = window.localStorage.getItem(dashboardStorageKey);

  if (!rawLayout) {
    return undefined;
  }

  try {
    const layout = JSON.parse(rawLayout) as unknown;
    return isSerializedDockviewLayout(layout)
      ? snapshotDockviewLayout(layout)
      : undefined;
  } catch (err) {
    console.error("Error parsing persisted layout", err);
    return undefined;
  }
}

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
      const layout = snapshotDockviewLayout(api.toJSON());
      persistDashboardLayout(layout);
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

    const persistedLayout =
      readPersistedDashboardLayout() ??
      (isSerializedDockviewLayout(layout)
        ? snapshotDockviewLayout(layout)
        : undefined);

    if (persistedLayout) {
      setLayout(persistedLayout);

      try {
        event.api.fromJSON(persistedLayout);
        initializeDashboardLayoutHistory(persistedLayout);
        return;
      } catch (err) {
        console.error("Error loading layout", err);
      }
    }

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

    const initialLayout = snapshotDockviewLayout(event.api.toJSON());
    persistDashboardLayout(initialLayout);
    setLayout(initialLayout);
    initializeDashboardLayoutHistory(initialLayout);
  };

  return (
    <div className="fixed flex h-full w-full flex-col p-1.25">
      <DashboardHeader />
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
      {/* These are not visible components */}
      <EditPanelDialog />
      <DashboardCommandMenu />
      <DashboardKeybinds />
    </div>
  );
}
