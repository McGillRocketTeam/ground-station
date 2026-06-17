import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  CreateDashboardPageInput,
  DashboardNameSchema,
  DashboardPathSegmentSchema,
  createDashboardPageAtom,
  dashboardPagesAtom,
  dashboardRouteTarget,
  normalizeDashboardPath,
  reservedDashboardPaths,
} from "@/lib/dashboard-persistence";

const NewDashboardFormSchemaBase = Schema.Struct({
  name: DashboardNameSchema,
  pathSegment: DashboardPathSegmentSchema,
});

export function NewDashboardPage() {
  const navigate = useNavigate();
  const createDashboardPage = useAtomSet(createDashboardPageAtom, { mode: "promise" });
  const pagesResult = useAtomValue(dashboardPagesAtom);
  const pages = AsyncResult.isSuccess(pagesResult) ? pagesResult.value : [];
  const existingPaths = useMemo(() => new Set(pages.map((page) => page.path)), [pages]);
  const schema = useMemo(
    () =>
      NewDashboardFormSchemaBase.check(
        Schema.makeFilter(({ pathSegment }) => {
          const path = normalizeDashboardPath(pathSegment);

          if (reservedDashboardPaths.has(path)) {
            return "The routes / and /new are reserved.";
          }

          if (existingPaths.has(path)) {
            return "A dashboard already exists at that route.";
          }
        }),
      ),
    [existingPaths],
  );

  const form = useForm({
    defaultValues: {
      name: "",
      pathSegment: "",
    } satisfies typeof NewDashboardFormSchemaBase.Encoded,
    validators: {
      onChangeAsync: Schema.toStandardSchemaV1(schema),
      onSubmitAsync: Schema.toStandardSchemaV1(schema),
    },
    onSubmit: async ({ value }) => {
      const page = await createDashboardPage(
        CreateDashboardPageInput.make({
          name: value.name,
          pathSegment: value.pathSegment,
        }),
      );

      navigate(dashboardRouteTarget(page.path));
    },
  });

  return (
    <div className="fixed inset-0 grid place-items-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create Dashboard Page</CardTitle>
          <CardDescription>
            Create a new dashboard on its own route. The default dashboard stays at /.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="new-dashboard-page-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="new-dashboard-page-name">Page Name</FieldLabel>
                      <Input
                        id="new-dashboard-page-name"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="Flight Deck"
                        autoComplete="off"
                      />
                      <FieldDescription>Give this dashboard a clear display name.</FieldDescription>
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="pathSegment">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="new-dashboard-page-path">Route</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>/</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="new-dashboard-page-path"
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value.toLowerCase())}
                          aria-invalid={isInvalid}
                          placeholder="flight-deck"
                          autoComplete="off"
                        />
                      </InputGroup>
                      <FieldDescription>Use one lowercase path segment.</FieldDescription>
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Subscribe selector={(state) => [state.errorMap]}>
                {([errorMap]) =>
                  errorMap.onSubmit ? <FieldError>{String(errorMap.onSubmit)}</FieldError> : null
                }
              </form.Subscribe>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/" })}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" form="new-dashboard-page-form" disabled={!canSubmit}>
                {isSubmitting ? "Creating..." : "Create Page"}
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </div>
  );
}
