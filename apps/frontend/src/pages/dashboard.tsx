import { useAtom, useAtomSet } from "@effect/atom-react";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { DockviewReact, themeAbyssSpaced, type DockviewReadyEvent } from "dockview-react";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";

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

import "./dashboard.css";
import { DashboardPlus } from "@/components/dashboard/plus";
import { DashboardTab } from "@/components/dashboard/tab";
import { ParameterDetail, parameterDetailPopoverHandle } from "@/components/parameter-detail";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { CardComponentMap, getCardActionsForPanel } from "@/lib/cards";
import {
  dashboardStorageKey,
  isSerializedDockviewLayout,
  persistDashboardLayout,
  readPersistedDashboardLayout,
  snapshotDockviewLayout,
} from "@/lib/dashboard-layout";
import { createId } from "@/lib/utils";

const runtime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage);

const dashboardLocalStorage = Atom.kvs({
  runtime: runtime,
  key: dashboardStorageKey,
  schema: Schema.ObjectKeyword,
  defaultValue: () => ({}),
});

export function DashboardPage() {
  const [api, setApi] = useAtom(dashboardDockviewApiAtom);
  const setActivePanel = useAtomSet(activePanelAtom);
  const setCurrentCardActions = useAtomSet(currentCardActionsAtom);
  const [layout, setLayout] = useAtom(dashboardLocalStorage);
  const initializeDashboardLayoutHistory = useAtomSet(initializeDashboardLayoutHistoryAtom);
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

    const persistedLayout =
      readPersistedDashboardLayout() ??
      (isSerializedDockviewLayout(layout) ? snapshotDockviewLayout(layout) : undefined);

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
      id: createId(),
    });
    // event.api.addPanel({
    //   title: "Command History",
    //   component: "command-history",
    //   id: createId(),
    // });
    event.api.addPanel({
      title: "Events",
      component: "events",
      id: createId(),
    });
    event.api.addPanel({
      title: "Links",
      component: "links",
      id: createId(),
    });
    // event.api.addPanel({
    //   title: "Map",
    //   component: "map-card",
    //   id: createId(),
    //   params: {
    //     latitude: 45.5017,
    //     longitude: -73.5673,
    //   },
    // });
    event.api.addPanel({
      title: "Command Buttons",
      component: "command-button",
      id: createId(),
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
      <Popover handle={parameterDetailPopoverHandle}>
        {({ payload }) =>
          payload && (
            <PopoverContent className="max-h-[58vh] max-w-[78vw] overflow-hidden p-0">
              <ParameterDetail
                className="max-h-[58vh] overflow-y-auto p-2.5 pr-2"
                qualifiedName={payload}
              />
            </PopoverContent>
          )
        }
      </Popover>
      <EditPanelDialog />
      <DashboardCommandMenu />
      <DashboardKeybinds />
    </div>
  );
}
