import type { IDockviewDefaultTabProps } from "dockview-react";

import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useSyncExternalStore } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { editPanelDialogHandle } from "./form/edit-dialog";

type CopiedCard = {
  component: string;
  params?: unknown;
  title?: string;
};

let copiedCard: CopiedCard | null = null;
const copiedCardListeners = new Set<() => void>();

function getCopiedCardSnapshot() {
  return copiedCard;
}

function subscribeToCopiedCard(listener: () => void) {
  copiedCardListeners.add(listener);

  return () => {
    copiedCardListeners.delete(listener);
  };
}

function setCopiedCard(card: CopiedCard) {
  copiedCard = card;

  for (const listener of copiedCardListeners) {
    listener();
  }
}

function cloneParams(params: unknown) {
  return params === undefined ? undefined : structuredClone(params);
}

export function DashboardTab(props: IDockviewDefaultTabProps) {
  const copied = useSyncExternalStore(
    subscribeToCopiedCard,
    getCopiedCardSnapshot,
    getCopiedCardSnapshot,
  );
  const panel = props.containerApi.getPanel(props.api.id);
  const handleDelete = () => {
    if (panel) props.containerApi.removePanel(panel);
  };
  const handleCopy = () => {
    if (!panel) return;

    setCopiedCard({
      component: panel.view.contentComponent,
      params: cloneParams(panel.params),
      title: panel.title,
    });
  };
  const handlePaste = () => {
    if (!panel || !copied) return;

    props.containerApi.addPanel({
      component: copied.component,
      id: crypto.randomUUID(),
      params: cloneParams(copied.params),
      position: {
        direction: "within",
        referencePanel: panel,
      },
      title: copied.title,
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-full place-items-center px-1">
        {props.api.title ?? "New Tab"}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={!panel} onClick={handleCopy}>
          Copy
        </ContextMenuItem>
        {copied ? (
          <ContextMenuItem onClick={handlePaste}>Paste</ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
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
          <ContextMenuShortcut>{formatForDisplay("Mod+E")}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
