import { Schema } from "effect";

export const Advancement = Schema.Struct({
  acknowledgment: Schema.String.pipe(
    Schema.withDecodingDefault(() => "Acknowledge_Queued"),
  ),
  wait: Schema.optional(Schema.Number),
});

export const TextStep = Schema.Struct({
  type: Schema.Literal("text"),
  comment: Schema.optional(Schema.String),
  text: Schema.String,
});

export const CheckStep = Schema.Struct({
  type: Schema.Literal("check"),
  comment: Schema.optional(Schema.String),
  parameters: Schema.Array(
    Schema.Struct({
      parameter: Schema.String,
    }),
  ),
});

const JsonValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.Any),
  Schema.Record(Schema.String, Schema.Any),
]);

export const VerifyCondition = Schema.Struct({
  parameter: Schema.String,
  operator: Schema.Literals(["eq", "neq", "le", "lte", "gt", "gte"]),
  value: JsonValue,
});

export const VerifyStep = Schema.Struct({
  type: Schema.Literal("verify"),
  comment: Schema.optional(Schema.String),
  condition: Schema.Array(VerifyCondition),
  delay: Schema.Int.pipe(Schema.withDecodingDefault(() => 0)),
  timeout: Schema.optional(Schema.Int),
});

export const CommandStep = Schema.Struct({
  type: Schema.Literal("command"),
  comment: Schema.optional(Schema.String),
  name: Schema.String,
  namespace: Schema.optional(Schema.String),
  arguments: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        value: JsonValue,
      }),
    ),
  ),
  extraOptions: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.String),
        value: Schema.optional(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
        ),
      }),
    ),
  ),
  stream: Schema.optional(Schema.String),
  advancement: Schema.optional(Advancement),
});

export const ProcedureStep = Schema.Union([
  TextStep,
  CheckStep,
  VerifyStep,
  CommandStep,
]);

export const ProcedureStack = Schema.Struct({
  steps: Schema.Array(ProcedureStep),
  advancement: Schema.optional(Advancement),
});
