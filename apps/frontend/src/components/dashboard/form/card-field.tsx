import type { AnyFieldApi } from "@tanstack/react-form";

import { Schema } from "effect";

import { formTitle, formType } from "@/lib/form";

import { Field, FieldError, FieldLabel } from "../../ui/field";
import { Input } from "../../ui/input";
import {
  DashboardParameterArrayField,
  type DashboardParameterArrayFieldApi,
} from "./parameter-array-field";
import {
  DashboardParameterField,
  type DashboardParameterFieldApi,
} from "./parameter-field";

function getFieldPlaceholder(type: ReturnType<typeof formType>) {
  switch (type) {
    case "parameter":
      return "Select a parameter";
    case "command":
      return "Enter a command";
    default:
      return "Enter a value";
  }
}

function getFieldErrors(field: AnyFieldApi) {
  return field.state.meta.errors.map((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return { message: error.message };
    }

    return { message: String(error) };
  });
}

function DashboardDefaultField({
  field,
  placeholder,
}: {
  field: AnyFieldApi;
  placeholder: string;
}) {
  return (
    <Input
      id={field.name}
      name={field.name}
      placeholder={placeholder}
      value={String(field.state.value ?? "")}
      onBlur={field.handleBlur}
      onChange={(event) => field.handleChange(event.target.value)}
    />
  );
}

export function DashboardCardField({
  field,
  fieldSchema,
}: {
  field: AnyFieldApi;
  fieldSchema: Schema.Schema<unknown>;
}) {
  const type = formType(fieldSchema);
  const placeholder = getFieldPlaceholder(type);

  return (
    <Field
      data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
    >
      <FieldLabel htmlFor={field.name}>{formTitle(fieldSchema)}</FieldLabel>
      {(() => {
        switch (type) {
          case "parameter":
            return (
              <DashboardParameterField
                field={field as DashboardParameterFieldApi}
              />
            );
          case "parameterArray":
            return (
              <DashboardParameterArrayField
                field={field as DashboardParameterArrayFieldApi}
              />
            );
          default:
            return (
              <DashboardDefaultField field={field} placeholder={placeholder} />
            );
        }
      })()}
      {field.state.meta.isTouched ? (
        <FieldError errors={getFieldErrors(field)} />
      ) : null}
    </Field>
  );
}
