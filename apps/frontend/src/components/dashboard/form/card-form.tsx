import { useForm } from "@tanstack/react-form";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Effect, Option, Schema } from "effect";
import { useMemo, useRef, useState } from "react";

import { type CardId, CardSchemaMap } from "@/lib/cards";
import { formDefaultValue, formType } from "@/lib/form";

import { Field, FieldError, FieldGroup, fieldLabelClassName } from "../../ui/field";
import { Input } from "../../ui/input";
import { DashboardCardField } from "./card-field";

type EncodedFormValues = Record<string, unknown>;
type DecodedFormValues = Record<string, unknown>;

function decode(schema: Schema.Codec<DecodedFormValues, EncodedFormValues>) {
  return function (value: unknown) {
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

function encodeDefaultFieldValue(fieldSchema: Schema.Codec<unknown, unknown>, value: unknown) {
  if (formType(fieldSchema) === "boolean") {
    return value ?? formDefaultValue(fieldSchema) ?? false;
  }

  if (value === undefined) {
    return undefined;
  }

  return Schema.encodeUnknownOption(fieldSchema)(value).pipe(
    Option.getOrElse(() =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? getDefaultFieldValue(value)
        : structuredClone(value),
    ),
  );
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
  const formSchema = schema as unknown as Schema.Codec<DecodedFormValues, EncodedFormValues> &
    Schema.Top & {
      readonly DecodingServices: never;
    };
  const parsedRef = useRef<DecodedFormValues | undefined>(undefined);
  const [title, setTitle] = useState(initialTitle ?? "");

  const defaultValues = useMemo<EncodedFormValues>(() => {
    return Object.fromEntries(
      Object.entries(schema.fields as Record<string, Schema.Codec<unknown, unknown>>).map(
        ([fieldName, fieldSchema]) => [
          fieldName,
          encodeDefaultFieldValue(fieldSchema, initialParams?.[fieldName]),
        ],
      ),
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

  useHotkey("Mod+S", () => {
    form.handleSubmit();
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
          <label className={fieldLabelClassName} htmlFor={`${formId}-title`}>
            Title
          </label>
          <Input
            id={`${formId}-title`}
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        {Object.entries(schema.fields as Record<string, Schema.Schema<unknown>>).map(
          ([fieldName, fieldSchema]) => {
            return (
              <form.Field key={fieldName} name={fieldName}>
                {(field) => <DashboardCardField field={field} fieldSchema={fieldSchema} />}
              </form.Field>
            );
          },
        )}

        {Object.keys(schema.fields).length === 0 ? (
          <div className="text-sm text-muted-foreground">
            This card has no configurable fields yet.
          </div>
        ) : null}
      </FieldGroup>

      <form.Subscribe selector={(state) => [state.errorMap]}>
        {([errorMap]) =>
          errorMap.onSubmit ? <FieldError>{String(errorMap.onSubmit)}</FieldError> : null
        }
      </form.Subscribe>
    </form>
  );
}
