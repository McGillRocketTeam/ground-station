import { useAtom, useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { formatForDisplay, type RegisterableHotkey } from "@tanstack/react-hotkeys";
import { Effect, Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Fragment, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";

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
import {
  dashboardAtom,
  dashboardsAtom,
  deleteDashboardAtom,
  importDashboardAtom,
} from "@/lib/atom/dashboard";
import { Dashboard } from "@/lib/dashboard-persistence";

import { editPanelDialogHandle } from "../form/edit-dialog";
import { newDashboardDialogHandle } from "../form/new-dashboard-dialog";
import { renameDashboardDialogHandle } from "../form/rename-dashboard-dialog";
import {
  activePanelAtom,
  currentCardActionsAtom,
  dashboardDockviewApiAtom,
  dashboardLayoutHistoryAtom,
  dashboardRedoAtom,
  dashboardUndoAtom,
} from "./layout";

const toggleFullscreenAtom = Atom.fn(() =>
  Effect.gen(function* () {
    if (document.fullscreenElement) {
      return yield* Effect.promise(() => document.exitFullscreen());
    }

    return yield* Effect.promise(() => document.documentElement.requestFullscreen());
  }),
);

const DashboardJson = Schema.fromJsonString(Dashboard);

function downloadDashboard(dashboard: Dashboard) {
  const blob = new Blob([Schema.encodeUnknownSync(DashboardJson)(dashboard)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replaceAll(":", "-");

  link.href = downloadUrl;
  link.download = `${dashboard.slug}-${timestamp}.json`;
  link.click();

  URL.revokeObjectURL(downloadUrl);
}

function pickDashboardFile(): Promise<Dashboard | undefined> {
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
        const contents = await file.text();
        resolve(await Schema.decodeUnknownPromise(DashboardJson)(contents));
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
  const api = useAtomValue(dashboardDockviewApiAtom);
  const { past, present, future } = useAtomValue(dashboardLayoutHistoryAtom);
  const { slug = "" } = useParams();
  const dashboard = Option.getOrUndefined(useAtomSuspense(dashboardAtom(slug)).value);
  const dashboards = useAtomSuspense(dashboardsAtom).value;
  const [importResult, importDashboard] = useAtom(importDashboardAtom);
  const [deleteResult, deleteDashboard] = useAtom(deleteDashboardAtom);
  const pendingNavigation = useRef<"import" | undefined>(undefined);
  const deleteNavigation = useRef<string | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    const result = importResult;
    if (!pendingNavigation.current || !AsyncResult.isSuccess(result)) {
      return;
    }

    pendingNavigation.current = undefined;
    navigate(`/dashboards/${result.value.slug}`);
  }, [importResult, navigate]);

  useEffect(() => {
    if (!deleteNavigation.current || !AsyncResult.isSuccess(deleteResult)) {
      return;
    }

    const nextSlug = deleteNavigation.current;
    deleteNavigation.current = undefined;
    navigate(`/dashboards/${nextSlug}`);
  }, [deleteResult, navigate]);

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
      id: "dashboard-management",
      heading: "Dashboard",
      actions: [
        {
          id: "new-dashboard",
          label: "New Dashboard",
          run: () => newDashboardDialogHandle.openWithPayload(crypto.randomUUID()),
        },
        {
          id: "rename-dashboard",
          label: "Rename Dashboard",
          keywords: ["dashboard", "rename", "name"],
          disabled: !dashboard,
          run: () => {
            if (dashboard) renameDashboardDialogHandle.openWithPayload(dashboard);
          },
        },
        {
          id: "delete-dashboard",
          label: "Delete Dashboard",
          keywords: ["dashboard", "delete", "remove"],
          disabled: dashboards.length === 1,
          destructive: true,
          run: () => {
            const nextDashboard = dashboards.find((item) => item.slug !== slug);
            if (
              !nextDashboard ||
              !window.confirm(`Delete ${dashboard?.name ?? "this dashboard"}?`)
            ) {
              return;
            }

            deleteNavigation.current = nextDashboard.slug;
            deleteDashboard(slug);
          },
        },
      ],
    },
    {
      id: "dashboard-transfer",
      heading: "Import and Export",
      actions: [
        {
          id: "import-dashboard",
          label: "Import Dashboard",
          keywords: ["dashboard", "import", "upload", "json"],
          disabled: !api,
          shortcut: "Mod+Shift+O",
          run: () => {
            if (!api) {
              return;
            }

            void pickDashboardFile().then((imported) => {
              if (!imported) {
                return;
              }
              pendingNavigation.current = "import";
              importDashboard(imported);
            });
          },
        },
        {
          id: "export-dashboard",
          label: "Export Dashboard",
          keywords: ["dashboard", "export", "download", "json"],
          disabled: !dashboard || (!api && !present),
          shortcut: "Mod+Shift+S",
          run: () => {
            if (!dashboard) {
              return;
            }
            downloadDashboard({
              ...dashboard,
              layout: api?.toJSON() ?? present ?? dashboard.layout,
            });
          },
        },
      ],
    },
    {
      id: "dashboard-list",
      heading: "Dashboards",
      actions: dashboards.map((item, index) => ({
        id: `open-dashboard-${item.slug}`,
        label: item.name,
        keywords: ["dashboard", "open", item.name, item.slug],
        disabled: item.slug === slug,
        href: `/dashboards/${item.slug}`,
        shortcut: (index < 10 ? `Alt+${index === 9 ? 0 : index + 1}` : undefined) as
          | RegisterableHotkey
          | undefined,
        run: () => navigate(`/dashboards/${item.slug}`),
      })),
    },
  ];
}

export function useDashboardDataActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const navigate = useNavigate();

  return [
    {
      id: "dashboard-data",
      heading: "Data",
      actions: [
        {
          id: "export-data",
          label: "Export Data",
          keywords: ["dashboard", "data", "export"],
          run: () => navigate("/export"),
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
  const visibleGroups = groups.filter((group) => group.actions.length > 0);

  return visibleGroups.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 ? <MenubarSeparator /> : null}
      <MenubarGroup>
        {group.actions.map((action) => (
          <MenubarItem
            key={action.id}
            disabled={action.disabled}
            render={action.href ? <Link to={action.href} /> : undefined}
            onClick={action.href ? undefined : action.run}
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
  const visibleGroups = groups.filter((group) => group.actions.length > 0);

  return visibleGroups.map((group) => (
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
