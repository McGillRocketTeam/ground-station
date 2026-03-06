import type { IDockviewDefaultTabProps } from "dockview-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function DashboardTab(props: IDockviewDefaultTabProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-full place-items-center px-1">
        {props.api.title ?? "New Tab"}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Edit</ContextMenuItem>
        <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
