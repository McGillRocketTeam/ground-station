import type { IDockviewPanel } from "dockview-react";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import {
  dashboardDockviewApiAtom,
  pushDashboardLayoutHistoryAtom,
} from "@/components/dashboard/actions/layout";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isCardId } from "@/lib/cards";
import {
  persistDashboardLayout,
  snapshotDockviewLayout,
} from "@/lib/dashboard-layout";

import { Button } from "../../ui/button";
import { DashboardCardForm } from "./card-form";

export const editPanelDialogHandle = Dialog.createHandle<IDockviewPanel>();

function EditPanelDialogForm({ payload }: { payload: IDockviewPanel }) {
  const api = useAtomValue(dashboardDockviewApiAtom);
  const pushDashboardLayoutHistory = useAtomSet(pushDashboardLayoutHistoryAtom);
  const componentId = payload.view.contentComponent;

  if (!isCardId(componentId)) {
    return (
      <div className="text-sm text-muted-foreground">
        No editable schema is registered for this card.
      </div>
    );
  }

  return (
    <DashboardCardForm
      key={payload.id}
      cardId={componentId}
      formId="edit-panel-form"
      initialParams={payload.params as Record<string, unknown> | undefined}
      initialTitle={payload.title}
      onSubmit={({ title, params }) => {
        payload.api.setTitle(title);
        payload.update({ params });

        if (api) {
          const layout = snapshotDockviewLayout(api.toJSON());
          persistDashboardLayout(layout);
          pushDashboardLayoutHistory(layout);
        }

        editPanelDialogHandle.close();
      }}
    />
  );
}

export function EditDialogPanel() {
  return (
    <Dialog
      disablePointerDismissal
      handle={editPanelDialogHandle}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "escape-key") {
          details.cancel();
        }
      }}
    >
      {({ payload }) =>
        payload && (
          <DialogContent className="sm:max-w-xl" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Edit Card</DialogTitle>
              <DialogDescription>
                Update the card title and schema-backed settings.
              </DialogDescription>
            </DialogHeader>

            <EditPanelDialogForm payload={payload} />

            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button form="edit-panel-form" type="submit">
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )
      }
    </Dialog>
  );
}
