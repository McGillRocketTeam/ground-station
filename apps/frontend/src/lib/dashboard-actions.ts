import type { RegisterableHotkey } from "@tanstack/react-hotkeys";

export type DashboardAction = {
  id: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  shortcut?: RegisterableHotkey;
  disabled?: boolean;
  destructive?: boolean;
  run: () => void;
};

export type DashboardActionGroup = {
  id: string;
  heading: string;
  actions: ReadonlyArray<DashboardAction>;
};
