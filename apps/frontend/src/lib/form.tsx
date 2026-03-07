import type { Atom } from "effect/unstable/reactivity";
import type { JSX } from "react";

import { Schema, SchemaAST } from "effect";

import { CommandField } from "@/components/form/command";
import { ParameterField } from "@/components/form/parameter";
import { StringField } from "@/components/form/string";

export const FormTypeAnnotationId: unique symbol = Symbol.for(
  "mrt/form/type",
) as never;
export const FormTitleAnnotationId: unique symbol = Symbol.for(
  "mrt/form/title",
) as never;

export type FormType = "unknown" | "string" | "parameter" | "command";

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly [FormTypeAnnotationId]?: FormType | undefined;
      readonly [FormTitleAnnotationId]?: string | undefined;
    }
  }
}

export const formType = (schema: Schema.Schema<unknown>): FormType =>
  (SchemaAST.resolve(schema.ast)?.[FormTypeAnnotationId] ??
    "unknown") as FormType;

export const formTitle = (schema: Schema.Schema<unknown>): string =>
  (SchemaAST.resolve(schema.ast)?.[FormTitleAnnotationId] ??
    "Unnamed Field") as string;

export type FormFieldRenderer = (
  title: string,
  atom: Atom.Writable<any, string>,
) => JSX.Element;

const formFieldMap = {
  string: StringField,
  parameter: ParameterField,
  unknown: () => <div>Unknown Form Component.</div>,
  command: CommandField,
} satisfies Record<FormType, FormFieldRenderer>;

export function FormField({
  type,
  title,
  atom,
}: {
  type: FormType;
  title: string;
  atom: Atom.Writable<any, string>;
}) {
  return formFieldMap[type](title, atom);
}
