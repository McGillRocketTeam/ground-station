import type { RegisterableHotkey } from "@tanstack/react-hotkeys";
import type { IDockviewPanel } from "dockview-react";

export const toggleCardMaximizedHotkey = "Mod+Shift+M" satisfies RegisterableHotkey;

export function toggleCardMaximized(panel: IDockviewPanel) {
  if (panel.api.isMaximized()) {
    panel.api.exitMaximized();
  } else {
    panel.api.maximize();
  }
}

export type DashboardAction = {
  id: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  shortcut?: RegisterableHotkey;
  disabled?: boolean;
  destructive?: boolean;
  href?: string;
  run: () => void;
};

export type DashboardActionGroup = {
  id: string;
  heading: string;
  actions: ReadonlyArray<DashboardAction>;
};
