import { Effect, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";

import { YAMCS_URL, YAMCS_INSTANCE } from "./Config.ts";

type DataSource =
  | "TELEMETERED"
  | "DERIVED"
  | "CONSTANT"
  | "LOCAL"
  | "SYSTEM"
  | "COMMAND"
  | "COMMAND_HISTORY"
  | "EXTERNAL1"
  | "EXTERNAL2"
  | "EXTERNAL3"
  | "GROUND";

export interface IntegerDataEncoding {
  readonly littleEndian: boolean;
  readonly sizeInBits: number;
  readonly type: "INTEGER";
  readonly encoding: "TWOS_COMPLEMENT" | "UNSIGNED";
}

export interface FloatDataEncoding {
  readonly littleEndian: boolean;
  readonly sizeInBits: number;
  readonly type: "FLOAT";
  readonly encoding: "IEEE754_1985";
}

export interface StringDataEncoding {
  readonly littleEndian: boolean;
  readonly sizeInBits: number;
  readonly type: "STRING";
  readonly encoding: string;
}

export type DataEncoding =
  | IntegerDataEncoding
  | FloatDataEncoding
  | StringDataEncoding;

interface EnumValue {
  readonly value: string;
  readonly label: string;
}

export interface ParameterType {
  readonly engType: string;
  readonly name?: string | undefined;
  readonly qualifiedName?: string | undefined;
  readonly dataEncoding: DataEncoding;
  readonly sizeInBits?: number | undefined;
  readonly enumValue?: ReadonlyArray<EnumValue> | undefined;
  readonly enumValues?: ReadonlyArray<EnumValue> | undefined;
}

export interface Parameter {
  readonly name: string;
  readonly qualifiedName: string;
  readonly shortDescription?: string | undefined;
  readonly dataSource: DataSource;
  readonly type: ParameterType;
}

export interface ContainerEntry {
  readonly locationInBits: number;
  readonly referenceLocation: "CONTAINER_START" | "PREVIOUS_ENTRY";
  readonly parameter?: Parameter | undefined;
  readonly container?: Container | undefined;
}

export interface Container {
  readonly name: string;
  readonly qualifiedName: string;
  readonly entry: ReadonlyArray<ContainerEntry>;
}

const DataSourceType: Schema.Schema<DataSource> = Schema.Literals([
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

const IntegerDataEncoding: Schema.Schema<IntegerDataEncoding> = Schema.Struct({
  littleEndian: Schema.Boolean,
  sizeInBits: Schema.Int,
  type: Schema.Literal("INTEGER"),
  encoding: Schema.Literals(["TWOS_COMPLEMENT", "UNSIGNED"]),
});

const FloatDataEncoding: Schema.Schema<FloatDataEncoding> = Schema.Struct({
  littleEndian: Schema.Boolean,
  sizeInBits: Schema.Int,
  type: Schema.Literal("FLOAT"),
  encoding: Schema.Literal("IEEE754_1985"),
});

const StringDataEncoding: Schema.Schema<StringDataEncoding> = Schema.Struct({
  littleEndian: Schema.Boolean,
  sizeInBits: Schema.Int,
  type: Schema.Literal("STRING"),
  encoding: Schema.String,
});

const DataEncodingInfo: Schema.Schema<DataEncoding> = Schema.Union([
  IntegerDataEncoding,
  FloatDataEncoding,
  StringDataEncoding,
]);

const EnumValueInfo: Schema.Schema<EnumValue> = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
});

const ParameterTypeInfo: Schema.Schema<ParameterType> = Schema.Struct({
  engType: Schema.String,
  name: Schema.optional(Schema.String),
  qualifiedName: Schema.optional(Schema.String),
  dataEncoding: DataEncodingInfo,
  sizeInBits: Schema.optional(Schema.Number),
  enumValue: Schema.optional(Schema.Array(EnumValueInfo)),
  enumValues: Schema.optional(Schema.Array(EnumValueInfo)),
});

const ParameterInfo: Schema.Schema<Parameter> = Schema.Struct({
  name: Schema.String,
  qualifiedName: Schema.String,
  shortDescription: Schema.optional(Schema.String),
  dataSource: DataSourceType,
  type: ParameterTypeInfo,
});

const ContainerInfo: Schema.Schema<Container> = Schema.suspend(() =>
  Schema.Struct({
    name: Schema.String,
    qualifiedName: Schema.String,
    entry: Schema.Array(SequenceEntryInfo),
  }),
);

const SequenceEntryInfo: Schema.Schema<ContainerEntry> = Schema.Struct({
  locationInBits: Schema.Number,
  referenceLocation: Schema.Literals(["CONTAINER_START", "PREVIOUS_ENTRY"]),
  parameter: Schema.optional(ParameterInfo),
  container: Schema.optional(ContainerInfo),
});

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
