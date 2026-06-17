import type { SerializedDockview } from "dockview-react";

import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { formatForDisplay, type RegisterableHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Schema } from "effect";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Atom } from "effect/unstable/reactivity";
import { Fragment } from "react";

import type { DashboardAction, DashboardActionGroup } from "@/lib/dashboard-actions";

import { resolveTheme, useTheme } from "@/components/theme-provider";
import { CommandGroup, CommandItem, CommandShortcut } from "@/components/ui/command";
import {
  MenubarGroup,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from "@/components/ui/menubar";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { isSerializedDockviewLayout, snapshotDockviewLayout } from "@/lib/dashboard-layout";
import {
  DashboardPageRecord,
  dashboardPagesAtom,
  getDashboardPageLayout,
  dashboardRouteTarget,
  encodeDashboardPage,
  importDashboardPageAtom,
  setDashboardPageLayout,
} from "@/lib/dashboard-persistence";

import { editPanelDialogHandle } from "../form/edit-dialog";
import {
  activePanelAtom,
  currentCardActionsAtom,
  dashboardDockviewApiAtom,
  dashboardLayoutHistoryAtom,
  dashboardRedoAtom,
  dashboardUndoAtom,
  initializeDashboardLayoutHistoryAtom,
} from "./layout";

export const toggleFullscreenAtom = Atom.fn(() =>
  Effect.gen(function* () {
    if (document.fullscreenElement) {
      return yield* Effect.promise(() => document.exitFullscreen());
    }

    return yield* Effect.promise(() => document.documentElement.requestFullscreen());
  }),
);

function downloadDashboardPage(page: DashboardPageRecord) {
  const blob = new Blob([encodeDashboardPage(page)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = page.name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  link.href = downloadUrl;
  link.download = `${slug || "dashboard"}.json`;
  link.click();

  URL.revokeObjectURL(downloadUrl);
}

function pickDashboardPageFile(): Promise<DashboardPageRecord | undefined> {
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
        resolve(
          Schema.decodeUnknownSync(Schema.fromJsonString(Schema.toCodecJson(DashboardPageRecord)))(
            await file.text(),
          ),
        );
      } catch (err) {
        console.error("Error importing dashboard page", err);
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
  const initializeDashboardLayoutHistory = useAtomSet(initializeDashboardLayoutHistoryAtom);
  const importDashboardPage = useAtomSet(importDashboardPageAtom, { mode: "promise" });
  const api = useAtomValue(dashboardDockviewApiAtom);
  const { past, present, future } = useAtomValue(dashboardLayoutHistoryAtom);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pagesResult = useAtomValue(dashboardPagesAtom);
  const pages = AsyncResult.isSuccess(pagesResult) ? pagesResult.value : [];
  const currentPage = pages.find((page) => page.path === pathname);

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
          keywords: ["dashboard", "page", "new", "create"],
          run: () => navigate({ to: "/new" }),
        },
        {
          id: "export-page",
          label: "Export Page",
          keywords: ["dashboard", "page", "export", "download", "json"],
          disabled: !currentPage,
          shortcut: "Mod+Shift+S",
          run: () => {
            if (!currentPage) {
              return;
            }

            const layout = api?.toJSON() ?? present ?? getDashboardPageLayout(currentPage);

            if (!isSerializedDockviewLayout(layout)) {
              return;
            }

            downloadDashboardPage(
              setDashboardPageLayout(currentPage, layout),
            );
          },
        },
        {
          id: "import-page",
          label: "Import Page",
          keywords: ["dashboard", "page", "import", "upload", "json"],
          disabled: false,
          shortcut: "Mod+Shift+O",
          run: () => {
            void pickDashboardPageFile().then((page) => {
              if (!page) {
                return;
              }

              void importDashboardPage(page).then((importedPage) => {
                void navigate(dashboardRouteTarget(importedPage.path));
                const importedLayout = getDashboardPageLayout(importedPage);

                if (importedLayout) {
                  initializeDashboardLayoutHistory(importedLayout);
                }
              });
            });
          },
        },
      ],
    },
    {
      id: "dashboard-open-pages",
      heading: "Open Page",
      actions: pages.map((page) => ({
        id: `open-page-${page.path}`,
        label: page.name,
        keywords: ["dashboard", "page", "open", page.path],
        disabled: page.path === pathname,
        run: () => {
          void navigate(dashboardRouteTarget(page.path));
        },
      })),
    },
  ];
}

export function useDashboardDataActionGroups(): ReadonlyArray<DashboardActionGroup> {
  return [];
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
          run: () => setTheme(resolveTheme(theme) === "dark" ? "light" : "dark"),
        },
      ],
    },
  ];
}

export function useDashboardCardActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const activePanel = useAtomValue(activePanelAtom);
  const currentCardActions = useAtomValue(currentCardActionsAtom);

  const groups: ReadonlyArray<DashboardActionGroup> = [
    ...currentCardActions,
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

  return groups.filter((group) => group.actions.length > 0);
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
        shortcut: String(index + 1) as RegisterableHotkey,
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
  return groups
    .filter((group) => group.actions.length > 0)
    .map((group, index) => (
      <Fragment key={group.id}>
        {index > 0 ? <MenubarSeparator /> : null}
        <MenubarGroup>
          {group.actions.map((action) => (
            <MenubarItem
              key={action.id}
              disabled={action.disabled}
              onClick={action.run}
              variant={action.destructive ? "destructive" : "default"}
              className="text-nowrap"
            >
              {action.label}
              {action.shortcut ? (
                <MenubarShortcut>
                  {formatForDisplay(action.shortcut as Parameters<typeof formatForDisplay>[0])}
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
  return groups
    .filter((group) => group.actions.length > 0)
    .map((group) => (
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
                {formatForDisplay(action.shortcut as Parameters<typeof formatForDisplay>[0])}
              </CommandShortcut>
            ) : null}
          </CommandItem>
        ))}
      </CommandGroup>
    ));
}
