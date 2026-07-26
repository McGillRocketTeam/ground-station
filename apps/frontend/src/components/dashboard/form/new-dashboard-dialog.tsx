import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtom } from "@effect/atom-react";
import { useForm } from "@tanstack/react-form";
import { Effect, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  fieldLabelClassName,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createDashboardAtom } from "@/lib/atom/dashboard";

const DashboardName = Schema.String.check(
  Schema.isPattern(/\S/, { message: "Enter a dashboard name" }),
);
const DashboardSlugInput = Schema.String.check(
  Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, numbers, and hyphens",
  }),
);
const NewDashboard = Schema.Struct({
  name: DashboardName,
  slug: DashboardSlugInput,
});

type NewDashboard = typeof NewDashboard.Type;

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const decode = (value: unknown) =>
  Schema.decodeUnknownEffect(NewDashboard)(value).pipe(
    Effect.mapError((error) => error.message),
    Effect.result,
    Effect.runPromise,
  );

function FieldValidation({ field }: { field: AnyFieldApi }) {
  return field.state.meta.isTouched && !field.state.meta.isValid ? (
    <FieldError errors={field.state.meta.errors} />
  ) : null;
}

export const newDashboardDialogHandle = Dialog.createHandle<string>();

function NewDashboardForm() {
  const [createResult, createDashboard] = useAtom(createDashboardAtom);
  const navigate = useNavigate();
  const parsedRef = useRef<NewDashboard | undefined>(undefined);
  const slugEditedRef = useRef(false);
  const submittingRef = useRef(false);
  const creating = submittingRef.current && AsyncResult.isWaiting(createResult);

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
    },
    validators: {
      onChangeAsync: Schema.toStandardSchemaV1(NewDashboard),
      onSubmitAsync: async ({ value }) => {
        const result = await decode(value);
        if (result._tag === "Failure") return result.failure;
        parsedRef.current = result.success;
      },
    },
    onSubmit: async () => {
      const parsed = parsedRef.current;
      if (!parsed) throw new Error("Unexpected submit without parsed data");
      submittingRef.current = true;
      createDashboard(parsed);
    },
  });

  useEffect(() => {
    if (!submittingRef.current || !AsyncResult.isSuccess(createResult)) return;

    submittingRef.current = false;
    newDashboardDialogHandle.close();
    navigate(`/dashboards/${createResult.value.slug}`);
  }, [createResult, navigate]);

  return (
    <form
      id="new-dashboard-form"
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
              <label className={fieldLabelClassName} htmlFor={field.name}>
                Name
              </label>
              <Input
                autoFocus
                id={field.name}
                name={field.name}
                placeholder="Mission Control"
                value={field.state.value}
                aria-invalid={!field.state.meta.isValid}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  const name = event.target.value;
                  field.handleChange(name);
                  if (!slugEditedRef.current) form.setFieldValue("slug", toSlug(name));
                }}
              />
              <FieldValidation field={field} />
            </Field>
          )}
        </form.Field>

        <form.Field name="slug">
          {(field) => (
            <Field data-invalid={!field.state.meta.isValid}>
              <label className={fieldLabelClassName} htmlFor={field.name}>
                Slug
              </label>
              <Input
                id={field.name}
                name={field.name}
                placeholder="mission-control"
                value={field.state.value}
                aria-invalid={!field.state.meta.isValid}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  slugEditedRef.current = true;
                  field.handleChange(event.target.value);
                }}
              />
              <FieldDescription>
                Used in the dashboard URL. You can customize it before creating the dashboard.
              </FieldDescription>
              <FieldValidation field={field} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      <DialogFooter className="mt-4">
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button form="new-dashboard-form" type="submit" disabled={!canSubmit || creating}>
              {isSubmitting || creating ? "Creating..." : "Create Dashboard"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

export function NewDashboardDialog() {
  return (
    <Dialog disablePointerDismissal handle={newDashboardDialogHandle}>
      {({ payload }) =>
        payload && (
          <DialogContent key={payload} showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>New Dashboard</DialogTitle>
              <DialogDescription>
                Create a separate workspace that can be opened in its own tab or window.
              </DialogDescription>
            </DialogHeader>
            <NewDashboardForm />
          </DialogContent>
        )
      }
    </Dialog>
  );
}
