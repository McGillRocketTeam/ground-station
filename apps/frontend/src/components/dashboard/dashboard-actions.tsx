import { useAtomSet, useAtomSuspense } from "@effect/atom-react";
import {
  formatForDisplay,
  type Hotkey,
  type ParsedHotkey,
} from "@tanstack/react-hotkeys";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { resolveTheme, useTheme } from "@/components/theme-provider";
import {
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  MenubarGroup,
  MenubarItem,
  MenubarShortcut,
} from "@/components/ui/menubar";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

export type DashboardAction = {
  id: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  shortcut?: Hotkey | ParsedHotkey;
  run: () => void;
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

export function useDashboardDashboardActions(): ReadonlyArray<DashboardAction> {
  return [
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
  ];
}

export function useDashboardViewActions(): ReadonlyArray<DashboardAction> {
  const toggleFullscreen = useAtomSet(toggleFullscreenAtom);
  const { theme, setTheme } = useTheme();

  return [
    {
      id: "toggle-fullscreen",
      label: "Toggle Fullscreen",
      keywords: ["view", "fullscreen"],
      shortcut: "Mod+Shift+F",
      run: () => toggleFullscreen(),
    },
    {
      id: "toggle-appearance",
      label: "Toggle Appearance",
      keywords: ["view", "appearance", "theme", "dark", "light"],
      run: () => setTheme(resolveTheme(theme) === "dark" ? "light" : "dark"),
    },
  ];
}

export function useDashboardInstanceActions(): ReadonlyArray<DashboardAction> {
  const setInstance = useAtomSet(selectedInstanceAtom);
  const { instances } = useAtomSuspense(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  ).value;

  return instances.map((instance, index) => ({
    id: `instance-${instance.name}`,
    label: instance.name,
    keywords: ["instance", "switch", instance.name, String(index + 1)],
    shortcut: String(index + 1) as Hotkey,
    run: () => setInstance(instance.name),
  }));
}

export function DashboardActionMenubarGroup({
  actions,
}: {
  actions: ReadonlyArray<DashboardAction>;
}) {
  return (
    <MenubarGroup>
      {actions.map((action) => (
        <MenubarItem key={action.id} onClick={action.run}>
          {action.label}
          {action.shortcut && (
            <MenubarShortcut>
              {formatForDisplay(action.shortcut)}
            </MenubarShortcut>
          )}
        </MenubarItem>
      ))}
    </MenubarGroup>
  );
}

export function DashboardActionCommandGroup({
  actions,
  heading,
  onAction,
}: {
  actions: ReadonlyArray<DashboardAction>;
  heading: string;
  onAction?: () => void;
}) {
  return (
    <CommandGroup heading={heading}>
      {actions.map((action) => (
        <CommandItem
          key={action.id}
          value={[action.label, ...(action.keywords ?? [])].join(" ")}
          onSelect={() => {
            action.run();
            onAction?.();
          }}
        >
          {action.label}
          {action.shortcut && (
            <CommandShortcut>
              {formatForDisplay(action.shortcut)}
            </CommandShortcut>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
