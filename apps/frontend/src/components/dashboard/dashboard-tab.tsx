import type { IDockviewDefaultTabProps } from "dockview-react";

export function DashboardTab(props: IDockviewDefaultTabProps) {
  return (
    <div className="grid place-items-center px-1 h-full">
      {props.api.title ?? "New Tab"}
    </div>
  );
}
