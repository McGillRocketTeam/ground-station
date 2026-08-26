import { useAtom, useAtomSet, useAtomSuspense } from "@effect/atom-react";
import { DockviewReact, themeAbyssSpaced, type DockviewReadyEvent } from "dockview-react";
import { Option } from "effect";
import { useEffect } from "react";
import { Navigate, useParams } from "react-router";

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
import { NewDashboardDialog } from "@/components/dashboard/form/new-dashboard-dialog";
import { RenameDashboardDialog } from "@/components/dashboard/form/rename-dashboard-dialog";
import { DashboardHeader } from "@/components/dashboard/header";

import "./dashboard.css";
import { DashboardPlus } from "@/components/dashboard/plus";
import { DashboardTab } from "@/components/dashboard/tab";
import { ParameterDetail, parameterDetailPopoverHandle } from "@/components/parameter-detail";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { dashboardAtom, saveDashboardLayoutAtom } from "@/lib/atom/dashboard";
import { CardComponentMap, getCardActionsForPanel } from "@/lib/cards";
import { isSerializedDockviewLayout, snapshotDockviewLayout } from "@/lib/dashboard-layout";
import { createId } from "@/lib/utils";

function Dashboard({ slug }: { slug: string }) {
  const dashboardResult = useAtomSuspense(dashboardAtom(slug));
  const dashboard = Option.getOrUndefined(dashboardResult.value);
  const [api, setApi] = useAtom(dashboardDockviewApiAtom);
  const setActivePanel = useAtomSet(activePanelAtom);
  const setCurrentCardActions = useAtomSet(currentCardActionsAtom);
  const [, saveLayout] = useAtom(saveDashboardLayoutAtom);
  const initializeDashboardLayoutHistory = useAtomSet(initializeDashboardLayoutHistoryAtom);
  const pushDashboardLayoutHistory = useAtomSet(pushDashboardLayoutHistoryAtom);

  useEffect(() => {
    if (!dashboard) return;

    const previousTitle = document.title;
    document.title = dashboard.name;
    return () => {
      document.title = previousTitle;
    };
  }, [dashboard]);

  useEffect(() => {
    if (!api) {
      return;
    }

    const disposable = api.onDidLayoutChange(() => {
      const layout = snapshotDockviewLayout(api.toJSON());
      saveLayout({ slug, layout });
      pushDashboardLayoutHistory(layout);
    });

    return () => disposable.dispose();
  }, [api, pushDashboardLayoutHistory, saveLayout, slug]);

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

    const persistedLayout = isSerializedDockviewLayout(dashboard?.layout)
      ? snapshotDockviewLayout(dashboard.layout)
      : undefined;

    if (persistedLayout) {
      try {
        event.api.fromJSON(persistedLayout);
        initializeDashboardLayoutHistory(persistedLayout);
        return;
      } catch (err) {
        console.error("[dashboard-persistence] page:restore:failed", { slug, err });
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
    saveLayout({ slug, layout: initialLayout });
    initializeDashboardLayoutHistory(initialLayout);
  };

  if (!dashboard) {
    return <Navigate replace to="/" />;
  }

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
      <NewDashboardDialog />
      <RenameDashboardDialog />
      <DashboardCommandMenu />
      <DashboardKeybinds />
    </div>
  );
}

export function DashboardPage() {
  const { slug } = useParams();
  return slug ? <Dashboard key={slug} slug={slug} /> : <Navigate replace to="/" />;
}
