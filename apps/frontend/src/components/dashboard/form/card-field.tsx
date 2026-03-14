import type { AnyFieldApi } from "@tanstack/react-form";

import { Schema, SchemaAST } from "effect";

import {
  FormMaxAnnotationId,
  FormMinAnnotationId,
  formTitle,
  formType,
} from "@/lib/form";

import { Field, FieldError, FieldLabel } from "../../ui/field";
import { Input } from "../../ui/input";
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
    case "coordinate":
      return "Enter coordinate";
    case "string":
    case "unknown":
      return "Enter a value";
  }
}

function getCoordinateBounds(schema: Schema.Schema<unknown>) {
  const annotations = SchemaAST.resolve(schema.ast);
  const min = annotations?.[FormMinAnnotationId];
  const max = annotations?.[FormMaxAnnotationId];

  if (typeof min === "number" && typeof max === "number") {
    return { min, max };
  }

  return undefined;
}

function getCoordinateRangeError(
  schema: Schema.Schema<unknown>,
  value: unknown,
): string | undefined {
  const bounds = getCoordinateBounds(schema);

  if (!bounds) {
    return undefined;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (parsed < bounds.min || parsed > bounds.max) {
    return `Expected value between ${bounds.min} and ${bounds.max}, got ${parsed}`;
  }

  return undefined;
}

export function validateDashboardFieldValue(
  fieldSchema: Schema.Schema<unknown>,
  value: unknown,
): string | undefined {
  if (formType(fieldSchema) === "coordinate") {
    return getCoordinateRangeError(fieldSchema, value);
  }

  return undefined;
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

function DashboardCoordinateField({
  field,
  fieldSchema,
  placeholder,
}: {
  field: AnyFieldApi;
  fieldSchema: Schema.Schema<unknown>;
  placeholder: string;
}) {
  const bounds = getCoordinateBounds(fieldSchema);

  return (
    <Input
      id={field.name}
      name={field.name}
      type="number"
      step="any"
      placeholder={placeholder}
      min={bounds?.min}
      max={bounds?.max}
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
  const coordinateError =
    type === "coordinate" && field.state.meta.isTouched
      ? validateDashboardFieldValue(fieldSchema, field.state.value)
      : undefined;
  const errors = getFieldErrors(field);
  if (coordinateError) {
    errors.push({ message: coordinateError });
  }

  return (
    <Field
      data-invalid={
        field.state.meta.isTouched &&
        (!field.state.meta.isValid || Boolean(coordinateError))
      }
    >
      <FieldLabel htmlFor={field.name}>{formTitle(fieldSchema)}</FieldLabel>
      {type === "parameter" ? (
        <DashboardParameterField field={field as DashboardParameterFieldApi} />
      ) : type === "coordinate" ? (
        <DashboardCoordinateField
          field={field}
          fieldSchema={fieldSchema}
          placeholder={placeholder}
        />
      ) : (
        <DashboardDefaultField field={field} placeholder={placeholder} />
      )}
      {field.state.meta.isTouched ? <FieldError errors={errors} /> : null}
    </Field>
  );
}
