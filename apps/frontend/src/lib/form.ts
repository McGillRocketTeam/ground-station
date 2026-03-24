import { Schema, SchemaAST } from "effect";

export const FormTypeAnnotationId: unique symbol = Symbol.for(
  "mrt/form/type",
) as never;
export const FormTitleAnnotationId: unique symbol = Symbol.for(
  "mrt/form/title",
) as never;

export type FormType =
  | "unknown"
  | "string"
  | "parameter"
  | "parameterArray"
  | "command";

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
