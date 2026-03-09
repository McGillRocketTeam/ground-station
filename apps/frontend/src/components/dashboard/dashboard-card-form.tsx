import type { AnyFieldApi } from "@tanstack/react-form";

import { useForm } from "@tanstack/react-form";
import { Effect, Schema } from "effect";
import { useMemo, useRef, useState } from "react";

import { type CardId, CardSchemaMap } from "@/lib/cards";
import { formTitle, formType } from "@/lib/form";

import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";

type EncodedFormValues = Record<string, string>;
type DecodedFormValues = Record<string, unknown>;

export function isCardId(value: string): value is CardId {
  return value in CardSchemaMap;
}

function decode(schema: Schema.Codec<DecodedFormValues, EncodedFormValues>) {
  return function(value: unknown) {
    return Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((error) => error.message),
      Effect.result,
      Effect.runPromise,
    );
  };
}

function getDefaultFieldValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function getFieldPlaceholder(type: ReturnType<typeof formType>) {
  switch (type) {
    case "parameter":
      return "Enter a parameter";
    case "command":
      return "Enter a command";
    case "string":
    case "unknown":
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

export function DashboardCardForm({
  cardId,
  formId,
  initialParams,
  initialTitle,
  onSubmit,
}: {
  cardId: CardId;
  formId: string;
  initialParams?: Record<string, unknown>;
  initialTitle?: string;
  onSubmit: (value: { title: string; params: DecodedFormValues }) => void;
}) {
  const schema = CardSchemaMap[cardId];
  const formSchema = schema as unknown as Schema.Codec<
    DecodedFormValues,
    EncodedFormValues
  > &
    Schema.Top & {
      readonly DecodingServices: never;
    };
  const parsedRef = useRef<DecodedFormValues | undefined>(undefined);
  const [title, setTitle] = useState(initialTitle ?? "");

  const defaultValues = useMemo<EncodedFormValues>(() => {
    return Object.fromEntries(
      Object.keys(schema.fields).map((fieldName) => [
        fieldName,
        getDefaultFieldValue(initialParams?.[fieldName]),
      ]),
    );
  }, [initialParams, schema.fields]);

  const form = useForm({
    defaultValues,
    validators: {
      onChangeAsync: Schema.toStandardSchemaV1(formSchema),
      onSubmitAsync: async ({ value }) => {
        const result = await decode(formSchema)(value);

        if (result._tag === "Failure") {
          return result.failure;
        }

        parsedRef.current = result.success;
      },
    },
    onSubmit: async () => {
      const parsed = parsedRef.current;

      if (!parsed) {
        throw new Error("Unexpected submit without parsed data");
      }

      onSubmit({ title, params: parsed });
    },
  });

  return (
    <form
      className="space-y-4"
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${formId}-title`}>Title</FieldLabel>
          <Input
            id={`${formId}-title`}
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        {Object.entries(
          schema.fields as Record<string, Schema.Schema<unknown>>,
        ).map(([fieldName, fieldSchema]) => {
          const type = formType(fieldSchema);

          return (
            <form.Field key={fieldName} name={fieldName}>
              {(field) => (
                <Field
                  data-invalid={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                >
                  <FieldLabel htmlFor={field.name}>{formTitle(fieldSchema)}</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder={getFieldPlaceholder(type)}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {field.state.meta.isTouched ? (
                    <FieldError errors={getFieldErrors(field)} />
                  ) : null}
                </Field>
              )}
            </form.Field>
          );
        })}

        {Object.keys(schema.fields).length === 0 ? (
          <div className="text-muted-foreground text-sm">
            This card has no configurable fields yet.
          </div>
        ) : null}
      </FieldGroup>

      <form.Subscribe selector={(state) => [state.errorMap]}>
        {([errorMap]) =>
          errorMap.onSubmit ? (
            <FieldError>{String(errorMap.onSubmit)}</FieldError>
          ) : null
        }
      </form.Subscribe>
    </form>
  );
}
