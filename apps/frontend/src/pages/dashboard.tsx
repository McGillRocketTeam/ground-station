import type { FunctionComponent } from "react";

import { useAtom, useAtomSet } from "@effect/atom-react";
import {
  DockviewReact,
  type IDockviewPanelProps,
  themeAbyssSpaced,
  type DockviewReadyEvent,
  type SerializedDockview,
} from "dockview-react";
import { useEffect, useState } from "react";

import type { DashboardPageRecord } from "@/lib/dashboard-persistence";

import { DashboardCommandMenu } from "@/components/dashboard/actions/command-menu";
import { DashboardKeybinds } from "@/components/dashboard/actions/keybinds";
import {
  activePanelAtom,
  currentCardActionsAtom,
  dashboardDockviewApiAtom,
  initializeDashboardLayoutHistoryAtom,
  pushDashboardLayoutHistoryAtom,
} from "@/components/dashboard/actions/layout";
import { DashboardMenuBar } from "@/components/dashboard/actions/menu-bar";
import { EditDialogPanel as EditPanelDialog } from "@/components/dashboard/form/edit-dialog";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardPlus } from "@/components/dashboard/plus";

import "./dashboard.css";
import { DashboardTab } from "@/components/dashboard/tab";
import { CardComponentMap, getCardActionsForPanel } from "@/lib/cards";
import { isSerializedDockviewLayout, snapshotDockviewLayout } from "@/lib/dashboard-layout";
import { writeDashboardLayoutAtom } from "@/lib/dashboard-persistence";
import { createId } from "@/lib/utils";

export function DashboardPage({
  page,
  initialLayout,
}: {
  page: DashboardPageRecord;
  initialLayout?: SerializedDockview;
}) {
  const [api, setApi] = useAtom(dashboardDockviewApiAtom);
  const setActivePanel = useAtomSet(activePanelAtom);
  const setCurrentCardActions = useAtomSet(currentCardActionsAtom);
  const writeDashboardLayout = useAtomSet(writeDashboardLayoutAtom);
  const [layout, setLayout] = useState<SerializedDockview | undefined>(initialLayout);
  const initializeDashboardLayoutHistory = useAtomSet(initializeDashboardLayoutHistoryAtom);
  const pushDashboardLayoutHistory = useAtomSet(pushDashboardLayoutHistoryAtom);

  useEffect(() => {
    setLayout(initialLayout);
  }, [initialLayout, page.path]);

  useEffect(() => {
    if (!api) {
      return;
    }

    const disposable = api.onDidLayoutChange(() => {
      const layout = snapshotDockviewLayout(api.toJSON());
      writeDashboardLayout({ path: page.path, layout });
      setLayout(layout);
      pushDashboardLayoutHistory(layout);
    });

    return () => disposable.dispose();
  }, [api, page.path, pushDashboardLayoutHistory]);

  useEffect(
    () => () => {
      setApi(undefined);
      setActivePanel(undefined);
      setCurrentCardActions([]);
    },
    [setActivePanel, setApi, setCurrentCardActions],
  );

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event.api);

    event.api.onDidActivePanelChange((panel) => {
      setActivePanel(panel);
      setCurrentCardActions(getCardActionsForPanel(panel));
    });

    const persistedLayout = isSerializedDockviewLayout(layout)
      ? snapshotDockviewLayout(layout)
      : undefined;

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
      title: "Links",
      component: "links",
      id: createId(),
    });

    const initialLayout = snapshotDockviewLayout(event.api.toJSON());
    writeDashboardLayout({ path: page.path, layout: initialLayout });
    setLayout(initialLayout);
    initializeDashboardLayoutHistory(initialLayout);
  };

  return (
    <div className="fixed flex h-full w-full flex-col p-1.25">
      <DashboardHeader pageName={page.name} pagePath={page.path} />
      <DashboardMenuBar />
      <div className="grow pt-1.25">
        <DockviewReact
          onReady={onReady}
          theme={{ ...themeAbyssSpaced, gap: 5 }}
          components={CardComponentMap as Record<string, FunctionComponent<IDockviewPanelProps>>}
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
