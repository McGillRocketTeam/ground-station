import type { SerializedDockview } from "dockview-react";

import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import {
  formatForDisplay,
  type Hotkey,
  type ParsedHotkey,
} from "@tanstack/react-hotkeys";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Fragment } from "react";

import { resolveTheme, useTheme } from "@/components/theme-provider";
import {
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  MenubarGroup,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from "@/components/ui/menubar";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import { editPanelDialogHandle } from "../form/edit-dialog";
import {
  activePanelAtom,
  dashboardDockviewApiAtom,
  dashboardLayoutHistoryAtom,
  dashboardRedoAtom,
  dashboardUndoAtom,
  initializeDashboardLayoutHistoryAtom,
} from "./layout";

export type DashboardAction = {
  id: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  shortcut?: Hotkey | ParsedHotkey;
  disabled?: boolean;
  destructive?: boolean;
  run: () => void;
};

export type DashboardActionGroup = {
  id: string;
  heading: string;
  actions: ReadonlyArray<DashboardAction>;
};

export const toggleFullscreenAtom = Atom.fn(() =>
  Effect.gen(function* () {
    if (document.fullscreenElement) {
      return yield* Effect.promise(() => document.exitFullscreen());
    }

    return yield* Effect.promise(() =>
      document.documentElement.requestFullscreen(),
    );
  }),
);

function downloadDashboardLayout(layout: unknown) {
  const blob = new Blob([JSON.stringify(layout, null, 2)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replaceAll(":", "-");

  link.href = downloadUrl;
  link.download = `dashboard-${timestamp}.json`;
  link.click();

  URL.revokeObjectURL(downloadUrl);
}

const dashboardStorageKey = "mrt-dashboard";

function isSerializedDockviewLayout(
  layout: unknown,
): layout is SerializedDockview {
  return (
    typeof layout === "object" &&
    layout !== null &&
    Object.keys(layout).length > 0
  );
}

function snapshotDashboardLayout(
  layout: SerializedDockview,
): SerializedDockview {
  return structuredClone(layout);
}

function pickDashboardLayoutFile(): Promise<SerializedDockview | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(undefined);
        return;
      }

      try {
        const rawLayout = await file.text();
        const layout = JSON.parse(rawLayout) as unknown;

        resolve(
          isSerializedDockviewLayout(layout)
            ? snapshotDashboardLayout(layout)
            : undefined,
        );
      } catch (err) {
        console.error("Error importing dashboard layout", err);
        resolve(undefined);
      }
    };

    input.click();
  });
}

export function flattenDashboardActionGroups(
  groups: ReadonlyArray<DashboardActionGroup>,
): ReadonlyArray<DashboardAction> {
  return groups.flatMap((group) => group.actions);
}

export function useDashboardDashboardActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const undo = useAtomSet(dashboardUndoAtom);
  const redo = useAtomSet(dashboardRedoAtom);
  const initializeDashboardLayoutHistory = useAtomSet(
    initializeDashboardLayoutHistoryAtom,
  );
  const api = useAtomValue(dashboardDockviewApiAtom);
  const { past, present, future } = useAtomValue(dashboardLayoutHistoryAtom);

  return [
    {
      id: "dashboard-history",
      heading: "History",
      actions: [
        {
          id: "undo-layout",
          label: "Undo",
          keywords: ["dashboard", "layout", "undo"],
          shortcut: "Mod+Z",
          disabled: past.length === 0,
          run: () => undo(),
        },
        {
          id: "redo-layout",
          label: "Redo",
          keywords: ["dashboard", "layout", "redo"],
          shortcut: "Mod+Shift+Z",
          disabled: future.length === 0,
          run: () => redo(),
        },
      ],
    },
    {
      id: "dashboard-page",
      heading: "Page",
      actions: [
        {
          id: "new-page",
          label: "New Page",
          run: () => {},
        },
        {
          id: "export-page",
          label: "Export Page",
          keywords: ["dashboard", "page", "export", "download", "json"],
          disabled: !api && !present,
          shortcut: "Mod+Shift+S",
          run: () => {
            const layout = api?.toJSON() ?? present;

            if (!layout) {
              return;
            }

            downloadDashboardLayout(layout);
          },
        },
        {
          id: "import-page",
          label: "Import Page",
          keywords: ["dashboard", "page", "import", "upload", "json"],
          disabled: !api,
          shortcut: "Mod+Shift+O",
          run: () => {
            if (!api) {
              return;
            }

            void pickDashboardLayoutFile().then((layout) => {
              if (!layout) {
                return;
              }

              try {
                api.fromJSON(layout);
                window.localStorage.setItem(
                  dashboardStorageKey,
                  JSON.stringify(layout),
                );
                initializeDashboardLayoutHistory(layout);
              } catch (err) {
                console.error("Error loading imported dashboard layout", err);
              }
            });
          },
        },
      ],
    },
  ];
}

export function useDashboardViewActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const toggleFullscreen = useAtomSet(toggleFullscreenAtom);
  const { theme, setTheme } = useTheme();

  return [
    {
      id: "view-actions",
      heading: "View",
      actions: [
        {
          id: "toggle-fullscreen",
          label: "Toggle Fullscreen",
          keywords: ["view", "fullscreen"],
          shortcut: "Mod+Shift+F",
          run: () => toggleFullscreen(),
        },
        {
          id: "toggle-appearance",
          label: "Toggle Theme",
          keywords: ["view", "appearance", "theme", "dark", "light"],
          shortcut: "D",
          run: () =>
            setTheme(resolveTheme(theme) === "dark" ? "light" : "dark"),
        },
      ],
    },
  ];
}

export function useDashboardCardActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const activePanel = useAtomValue(activePanelAtom);
  return [
    {
      id: "card-actions",
      heading: "Card",
      actions: [
        {
          id: "edit-card",
          label: "Edit Card",
          shortcut: "Mod+E",
          disabled: !activePanel,
          run: () => {
            if (!activePanel) {
              return;
            }

            editPanelDialogHandle.openWithPayload(activePanel);
          },
        },
        {
          id: "delete-card",
          label: "Delete Card",
          disabled: !activePanel,
          destructive: true,
          run: () => {
            if (!activePanel) {
              return;
            }

            activePanel.api.close();
          },
        },
      ],
    },
  ];
}

export function useDashboardInstanceActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const setInstance = useAtomSet(selectedInstanceAtom);
  const { instances } = useAtomSuspense(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  ).value;

  return [
    {
      id: "instance-switch",
      heading: "Switch Instance",
      actions: instances.map((instance, index) => ({
        id: `instance-${instance.name}`,
        label: instance.name
          .split("-")
          .map((i) => i.charAt(0).toLocaleUpperCase() + i.substring(1))
          .join(" "),
        keywords: ["instance", "switch", instance.name, String(index + 1)],
        shortcut: String(index + 1) as Hotkey,
        run: () => setInstance(instance.name),
      })),
    },
  ];
}

export function DashboardActionMenubarGroups({
  groups,
}: {
  groups: ReadonlyArray<DashboardActionGroup>;
}) {
  return groups.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 ? <MenubarSeparator /> : null}
      <MenubarGroup>
        {group.actions.map((action) => (
          <MenubarItem
            key={action.id}
            disabled={action.disabled}
            onClick={action.run}
            variant={action.destructive ? "destructive" : "default"}
          >
            {action.label}
            {action.shortcut ? (
              <MenubarShortcut>
                {formatForDisplay(action.shortcut)}
              </MenubarShortcut>
            ) : null}
          </MenubarItem>
        ))}
      </MenubarGroup>
    </Fragment>
  ));
}

export function DashboardActionCommandGroups({
  groups,
  onAction,
}: {
  groups: ReadonlyArray<DashboardActionGroup>;
  onAction?: () => void;
}) {
  return groups.map((group) => (
    <CommandGroup heading={group.heading} key={group.id}>
      {group.actions.map((action) => (
        <CommandItem
          disabled={action.disabled}
          key={action.id}
          variant={action.destructive ? "destructive" : "default"}
          value={[action.label, ...(action.keywords ?? [])].join(" ")}
          onSelect={() => {
            if (action.disabled) {
              return;
            }

            action.run();
            onAction?.();
          }}
        >
          {action.label}
          {action.shortcut ? (
            <CommandShortcut>
              {formatForDisplay(action.shortcut)}
            </CommandShortcut>
          ) : null}
        </CommandItem>
      ))}
    </CommandGroup>
  ));
}
