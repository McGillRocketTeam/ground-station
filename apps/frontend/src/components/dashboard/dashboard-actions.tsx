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

import {
  dashboardLayoutHistoryAtom,
  dashboardRedoAtom,
  dashboardUndoAtom,
} from "./dashboard-layout";

export type DashboardAction = {
  id: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  shortcut?: Hotkey | ParsedHotkey;
  disabled?: boolean;
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

export function flattenDashboardActionGroups(
  groups: ReadonlyArray<DashboardActionGroup>,
): ReadonlyArray<DashboardAction> {
  return groups.flatMap((group) => group.actions);
}

export function useDashboardDashboardActionGroups(): ReadonlyArray<DashboardActionGroup> {
  const undo = useAtomSet(dashboardUndoAtom);
  const redo = useAtomSet(dashboardRedoAtom);
  const { past, future } = useAtomValue(dashboardLayoutHistoryAtom);

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
          id: "rename-page",
          label: "Rename Page",
          run: () => {},
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
        label: instance.name,
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
