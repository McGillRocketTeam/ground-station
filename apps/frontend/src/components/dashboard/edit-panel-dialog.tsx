import type { IDockviewPanel } from "dockview-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "../ui/button";

export const editPanelDialogHandle = Dialog.createHandle<IDockviewPanel>();

export function EditDialogPanel() {
  return (
    <Dialog handle={editPanelDialogHandle}>
      {({ payload }) => (
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you&apos;re
              done.
            </DialogDescription>
          </DialogHeader>
          <div>{payload?.api.title}</div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
