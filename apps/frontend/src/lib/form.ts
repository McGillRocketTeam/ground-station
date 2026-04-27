import { Schema, SchemaAST } from "effect";

export const FormTypeAnnotationId: unique symbol = Symbol.for(
  "mrt/form/type",
) as never;
export const FormTitleAnnotationId: unique symbol = Symbol.for(
  "mrt/form/title",
) as never;
export const FormMinAnnotationId: unique symbol = Symbol.for(
  "mrt/form/min",
) as never;
export const FormMaxAnnotationId: unique symbol = Symbol.for(
  "mrt/form/max",
) as never;

export type FormType =
  | "unknown"
  | "string"
  | "parameter"
  | "parameterArray"
  | "gaugeVisualRanges"
  | "chartSeries"
  | "parameterTableSections"
  | "command"
  | "coordinate";

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly [FormTypeAnnotationId]?: FormType | undefined;
      readonly [FormTitleAnnotationId]?: string | undefined;
      readonly [FormMinAnnotationId]?: number | undefined;
      readonly [FormMaxAnnotationId]?: number | undefined;
    }
  }
}

export const formType = (schema: Schema.Schema<unknown>): FormType =>
  (SchemaAST.resolve(schema.ast)?.[FormTypeAnnotationId] ??
    "unknown") as FormType;

export const formTitle = (schema: Schema.Schema<unknown>): string =>
  (SchemaAST.resolve(schema.ast)?.[FormTitleAnnotationId] ??
    "Unnamed Field") as string;
