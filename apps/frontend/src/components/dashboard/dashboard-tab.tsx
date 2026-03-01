import type { IDockviewDefaultTabProps } from "dockview-react";

export function DashboardTab(props: IDockviewDefaultTabProps) {
  return <div className="grid h-full place-items-center px-1">{props.api.title ?? "New Tab"}</div>;
}
