import type { IDockviewDefaultTabProps } from "dockview-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { editPanelDialogHandle } from "./edit-panel-dialog";

export function DashboardTab(props: IDockviewDefaultTabProps) {
  const panel = props.containerApi.getPanel(props.api.id);
  const handleDelete = () => {
    if (panel) props.containerApi.removePanel(panel);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-full place-items-center px-1">
        {props.api.title ?? "New Tab"}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!panel}
          onClick={() => {
            if (!panel) {
              return;
            }

            editPanelDialogHandle.openWithPayload(panel);
          }}
        >
          Edit
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
