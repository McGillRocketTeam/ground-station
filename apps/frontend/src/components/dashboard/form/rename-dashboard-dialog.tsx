import { useAtom } from "@effect/atom-react";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, fieldLabelClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { renameDashboardAtom, type Dashboard } from "@/lib/atom/dashboard";

const RenameDashboard = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/\S/, { message: "Enter a dashboard name" })),
});

export const renameDashboardDialogHandle = Dialog.createHandle<Dashboard>();

function RenameDashboardForm({ dashboard }: { dashboard: Dashboard }) {
  const [renameResult, renameDashboard] = useAtom(renameDashboardAtom);
  const submittedRef = useRef(false);
  const form = useForm({
    defaultValues: { name: dashboard.name },
    validators: { onChange: Schema.toStandardSchemaV1(RenameDashboard) },
    onSubmit: async ({ value }) => {
      submittedRef.current = true;
      renameDashboard({ slug: dashboard.slug, name: value.name });
    },
  });

  useEffect(() => {
    if (!submittedRef.current || !AsyncResult.isSuccess(renameResult)) return;
    submittedRef.current = false;
    renameDashboardDialogHandle.close();
  }, [renameResult]);

  const renaming = submittedRef.current && AsyncResult.isWaiting(renameResult);

  return (
    <form
      id="rename-dashboard-form"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <label className={fieldLabelClassName} htmlFor="rename-dashboard-name">
                Name
              </label>
              <Input
                autoFocus
                id="rename-dashboard-name"
                value={field.state.value}
                aria-invalid={!field.state.meta.isValid}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {field.state.meta.isTouched && !field.state.meta.isValid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      <DialogFooter className="mt-4">
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || renaming}>
              {isSubmitting || renaming ? "Renaming..." : "Rename Dashboard"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

export function RenameDashboardDialog() {
  return (
    <Dialog disablePointerDismissal handle={renameDashboardDialogHandle}>
      {({ payload }) =>
        payload && (
          <DialogContent key={`${payload.slug}-${payload.name}`} showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Rename Dashboard</DialogTitle>
              <DialogDescription>
                Change the dashboard name. Its URL will remain the same.
              </DialogDescription>
            </DialogHeader>
            <RenameDashboardForm dashboard={payload} />
          </DialogContent>
        )
      }
    </Dialog>
  );
}
