import { Effect, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";

import { YAMCS_URL, YAMCS_INSTANCE } from "./Config.ts";

const DataSourceType = Schema.Literals([
  "TELEMETERED",
  "DERIVED",
  "CONSTANT",
  "LOCAL",
  "SYSTEM",
  "COMMAND",
  "COMMAND_HISTORY",
  "EXTERNAL1",
  "EXTERNAL2",
  "EXTERNAL3",
  "GROUND",
]);

const baseFields = {
  littleEndian: Schema.Boolean,
  sizeInBits: Schema.Int,
};

const IntegerDataEncoding = Schema.Struct({
  ...baseFields,
  type: Schema.Literal("INTEGER"),
  encoding: Schema.Literals(["TWOS_COMPLEMENT", "UNSIGNED"]),
});

const FloatDataEncoding = Schema.Struct({
  ...baseFields,
  type: Schema.Literal("FLOAT"),
  encoding: Schema.Literal("IEEE754_1985"),
});

const DataEncodingInfo = Schema.Union([IntegerDataEncoding, FloatDataEncoding]);

const ParameterTypeInfo = Schema.Struct({
  engType: Schema.String,
  name: Schema.String,
  qualifiedName: Schema.String,
  dataEncoding: DataEncodingInfo,
  sizeInBits: Schema.Number,
});

const ParameterInfo = Schema.Struct({
  name: Schema.String,
  qualifiedName: Schema.String,
  shortDescription: Schema.optional(Schema.String),
  dataSource: DataSourceType,
  type: ParameterTypeInfo,
});

const SequenceEntryInfo = Schema.Struct({
  locationInBits: Schema.Number,
  referenceLocation: Schema.Literals(["CONTAINER_START", "PREVIOUS_ENTRY"]),
  parameter: ParameterInfo,
});

const ContainerInfo = Schema.Struct({
  name: Schema.String,
  qualifiedName: Schema.String,
  entry: Schema.Array(SequenceEntryInfo),
});

export type DataEncoding = typeof DataEncodingInfo.Type;
export type Container = typeof ContainerInfo.Type;
export type ContainerEntry = typeof SequenceEntryInfo.Type;

export const getContainer = (basePath: string, containerName: string) =>
  Effect.gen(function* () {
    const baseUrl = yield* YAMCS_URL;
    const instance = yield* YAMCS_INSTANCE;
    const client = yield* HttpClient.HttpClient;

    const result = yield* client.get(
      `${baseUrl}/api/mdb/${instance}/containers/${basePath}/${containerName}`,
    );

    const text = yield* result.text;

    const container = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(ContainerInfo),
    )(text).pipe(
      Effect.tapErrorTag("SchemaError", (e) => Effect.logError(e.message)),
    );

    return container;
  });
