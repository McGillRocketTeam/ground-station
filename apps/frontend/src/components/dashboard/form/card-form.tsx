import { useForm } from "@tanstack/react-form";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Effect, Schema } from "effect";
import { useMemo, useRef, useState } from "react";

import { type CardId, CardSchemaMap } from "@/lib/cards";

import { Field, FieldError, FieldGroup, FieldLabel } from "../../ui/field";
import { Input } from "../../ui/input";
import { DashboardCardField } from "./card-field";

type EncodedFormValues = Record<string, unknown>;
type DecodedFormValues = Record<string, unknown>;

export function isCardId(value: string): value is CardId {
  return value in CardSchemaMap;
}

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

function encodeDefaultFieldValue(
  fieldSchema: Schema.Schema<unknown>,
  value: unknown,
) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return Schema.encodeUnknownSync(
      fieldSchema as Schema.Top & { readonly EncodingServices: never },
    )(value);
  } catch {
    return getDefaultFieldValue(value);
  }
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
  useHotkey("Mod+S", () => {
    form.handleSubmit();
  });

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
      Object.entries(
        schema.fields as Record<string, Schema.Schema<unknown>>,
      ).map(([fieldName, fieldSchema]) => [
        fieldName,
        encodeDefaultFieldValue(fieldSchema, initialParams?.[fieldName]),
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
          return (
            <form.Field key={fieldName} name={fieldName}>
              {(field) => (
                <DashboardCardField field={field} fieldSchema={fieldSchema} />
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
