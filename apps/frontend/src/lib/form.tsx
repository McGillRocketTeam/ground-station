import { CommandField } from "@/components/form/command";
import { ParameterField } from "@/components/form/parameter";
import { StringField } from "@/components/form/string";
import type { Atom } from "@effect-atom/atom-react";
import { Option, Schema, SchemaAST } from "effect";
import type { JSX } from "react";

export const FormTypeAnnotationId = Symbol.for("mrt/form/type");
export const FormTitleAnnotationId = Symbol.for("mrt/form/title");

export type FormType = "unknown" | "string" | "parameter" | "command";

declare module "effect/Schema" {
  namespace Annotations {
    interface GenericSchema<A> extends Schema<A> {
      [FormTypeAnnotationId]?: FormType;
    }
  }
}

export const formType = <A, I, R>(schema: Schema.Schema<A, I, R>): FormType =>
  SchemaAST.getAnnotation<FormType>(FormTypeAnnotationId)(schema.ast).pipe(
    Option.getOrElse(() => "unknown"),
  ) as FormType;

export const formTitle = <A, I, R>(schema: Schema.Schema<A, I, R>): string =>
  SchemaAST.getAnnotation<string>(FormTitleAnnotationId)(schema.ast).pipe(
    Option.getOrElse(() => "Unnamed Field"),
  );

export type FormFieldRenderer = (title: string, atom: Atom.Writable<any, string>) => JSX.Element;

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
