import { Schema } from "effect";

import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";

export const CommandEntry = Schema.Struct({
  command: Schema.String,
  args: Schema.Record(Schema.String, Schema.String),
});

export type CommandEntry = typeof CommandEntry.Type;

export const ControlBoxCommandEntry = Schema.Struct({
  command: CommandEntry.fields.command,
  args: CommandEntry.fields.args,
  controlId: Schema.optional(Schema.String),
  localName: Schema.optional(Schema.String),
});

export type ControlBoxCommandEntry = typeof ControlBoxCommandEntry.Type;

export const CommandArrayField = Schema.optional(
  Schema.Array(Schema.Union([Schema.String, CommandEntry])),
).pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Commands",
    [FormTypeAnnotationId]: "commandArray",
  }),
);

export type CommandArrayEntry = NonNullable<typeof CommandArrayField.Type>[number];

export const ControlBoxCommandArrayField = Schema.optional(
  Schema.Array(Schema.Union([Schema.String, ControlBoxCommandEntry])),
).pipe(
  Schema.annotate({
    [FormTitleAnnotationId]: "Commands",
    [FormTypeAnnotationId]: "controlBoxCommandArray",
  }),
);

export type ControlBoxCommandArrayEntry = NonNullable<
  typeof ControlBoxCommandArrayField.Type
>[number];

export function normalizeCommandEntry(entry: CommandArrayEntry): CommandEntry {
  return typeof entry === "string" ? { command: entry, args: {} } : entry;
}

export function normalizeControlBoxCommandEntry(
  entry: ControlBoxCommandArrayEntry,
): ControlBoxCommandEntry {
  return typeof entry === "string" ? { command: entry, args: {} } : entry;
}
