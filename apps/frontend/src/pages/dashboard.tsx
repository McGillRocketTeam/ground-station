import { useAtom, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import {
  DockviewApi,
  DockviewReact,
  themeAbyssSpaced,
  type DockviewReadyEvent,
  type SerializedDockview,
} from "dockview-react";
import { Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Suspense, useEffect, useState } from "react";

import { DashboardCommandMenu } from "@/components/dashboard/dashboard-command";
import { DashboardKeybinds } from "@/components/dashboard/dashboard-keybinds";
import { DashboardPlus } from "@/components/dashboard/dashboard-plus";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  selectedInstanceAtom,
  timeSubscriptionAtom,
  YamcsAtomHttpClient,
} from "@/lib/atom";

import "./dashboard.css";
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
      throw "test";
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
  };

  return (
    <div className="fixed flex h-full w-full flex-col gap-1.25 p-1.25">
      <div className="flex flex-row justify-between">
        <TitleMenu />
        <MissionTime />
      </div>
      <DashboardCommandMenu />
      <DashboardKeybinds />
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

function TitleMenu() {
  const [selectedInstance, setSelectedInstance] = useAtom(selectedInstanceAtom);
  const instancesResult = useAtomValue(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="flex flex-col font-mono text-xs uppercase items-start">
          <div className="text-mrt">McGill Rocket Team</div>
          <div className="text-muted-foreground">Ground Station Controls</div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Instance</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {AsyncResult.builder(instancesResult)
                  .onInitial(() => (
                    <DropdownMenuItem className="animate-pulse">
                      {selectedInstance}
                    </DropdownMenuItem>
                  ))
                  .onSuccess(({ instances }) => (
                    <DropdownMenuRadioGroup
                      value={selectedInstance}
                      onValueChange={setSelectedInstance}
                    >
                      {instances.map((instance) => (
                        <DropdownMenuRadioItem
                          closeOnClick
                          key={instance.name}
                          value={instance.name}
                        >
                          {instance.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  ))
                  .render()}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
