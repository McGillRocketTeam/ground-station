import { Schema, SchemaIssue, Option, Effect, SchemaGetter } from "effect";

export const NamedObjectId = Schema.Struct({
  name: Schema.String,
  namespace: Schema.optional(Schema.String),
});

export const QualifiedName = Schema.String;
export type QualifiedName = typeof Schema.String.Type;

const YamcsDateFromMillisString = Schema.NumberFromString.pipe(
  Schema.decodeTo(Schema.DateTimeUtcFromMillis),
);

export const YamcsDate = Schema.Union([
  Schema.DateTimeUtcFromMillis,
  Schema.DateTimeUtcFromString,
  YamcsDateFromMillisString,
]);

const name = Schema.String;
const qualifiedName = QualifiedName;

// Short description (one line)
const shortDescription = Schema.optional(Schema.String);

// Long description (Markdown)
const longDescription = Schema.optional(Schema.String);
const alias = Schema.optional(Schema.Array(NamedObjectId));

export const UnitInfo = Schema.Struct({
  unit: Schema.String,
});

export const PolynomialCalibratorInfo = Schema.Struct({
  type: Schema.Literal("POLYNOMIAL"),
  coefficients: Schema.Array(Schema.Number),
});

export const SplinePointInfo = Schema.Struct({
  raw: Schema.Number,
  calibrated: Schema.Number,
});

export const SplineCalibratorInfo = Schema.Struct({
  type: Schema.Literal("SPLINE"),
  points: Schema.Array(SplinePointInfo),
});

export const JavaExpressionCalibratorInfo = Schema.Struct({
  type: Schema.Literal("JAVA_EXPRESSION"),
  formula: Schema.String,
});

export const MathOperationCalibratorInfo = Schema.Struct({
  type: Schema.Literal("MATH_OPERATION"),
});

export const CalibratorInfo = Schema.Struct({
  type: Schema.Literals([
    "POLYNOMIAL",
    "SPLINE",
    "MATH_OPERATION",
    "JAVA_EXPRESSION",
    "ALGORITHM",
  ]),
  polynomialCalibrator: Schema.optional(PolynomialCalibratorInfo),
  splineCalibrator: Schema.optional(SplineCalibratorInfo),
  javaExpressionCalibrator: Schema.optional(JavaExpressionCalibratorInfo),
}).pipe(
  Schema.decodeTo(
    Schema.Union([
      JavaExpressionCalibratorInfo,
      SplineCalibratorInfo,
      PolynomialCalibratorInfo,
      MathOperationCalibratorInfo,
    ]),
    {
      decode: SchemaGetter.transformOrFail((input) =>
        Effect.gen(function* () {
          switch (input.type) {
            case "SPLINE":
              return yield* Effect.succeed(input.splineCalibrator!);
            case "POLYNOMIAL":
              return yield* Effect.succeed(input.polynomialCalibrator!);
            case "JAVA_EXPRESSION":
              return yield* Effect.succeed(input.javaExpressionCalibrator!);
            case "MATH_OPERATION":
              return yield* Effect.succeed(
                MathOperationCalibratorInfo.make({
                  type: "MATH_OPERATION",
                }),
              );
            default:
              return yield* Effect.fail(
                new SchemaIssue.InvalidValue(Option.some(input.type), {
                  cause: "Unknown case",
                }),
              );
          }
        }),
      ),
      encode: SchemaGetter.transformOrFail(() =>
        Effect.fail(
          new SchemaIssue.InvalidValue(Option.some({}), {
            cause: "Can't Encode",
          }),
        ),
      ),
    },
  ),
);

export const DataEncodingType = Schema.Literals([
  "BINARY",
  "BOOLEAN",
  "FLOAT",
  "INTEGER",
  "STRING",
]);

export const DataEncodingInfo = Schema.Struct({
  type: DataEncodingType,
  littleEndian: Schema.optional(Schema.Boolean),
  sizeInBits: Schema.optional(Schema.Int),
  encoding: Schema.optional(Schema.String),
  defaultCalibrator: Schema.optional(CalibratorInfo),
  // contextCalibrators: Schema.Array(ContextCalibratorInfo)
});

export const ParameterTypeInfo = Schema.Struct({
  name,
  qualifiedName,
  shortDescription,
  longDescription,
  alias,

  // Engineering Type
  engType: Schema.String,
  dataEncoding: Schema.optional(DataEncodingInfo),
  unitSet: Schema.optional(Schema.Array(UnitInfo)),
});

export const DataSourceType = Schema.Literals([
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

export const ParameterInfo = Schema.Struct({
  name,
  qualifiedName,
  shortDescription,
  longDescription,
  alias,
  type: ParameterTypeInfo,
  dataSource: DataSourceType,
  // usedBy: UsedByInfo
  // ancillaryData: {[key: string]: AncillaryDataInfo},
});

export const HistoryInfo = Schema.Struct({
  version: Schema.String,
  date: Schema.String,
  message: Schema.String,
  author: Schema.String,
});

const spaceSystemInfoFields = {
  name,
  qualifiedName,
  shortDescription,
  longDescription,
  alias,
  version: Schema.optional(Schema.String),
  history: Schema.optional(Schema.Array(HistoryInfo)),
  // ancillaryData: {[key: Schema.String]: AncillaryDataInfo},
};

export interface SpaceSystemInfo extends Schema.Struct.Type<
  typeof spaceSystemInfoFields
> {
  // Define `subcategories` using recursion
  readonly sub?: ReadonlyArray<SpaceSystemInfo> | undefined;
}

export const SpaceSystemInfo = Schema.Struct({
  ...spaceSystemInfoFields,
  sub: Schema.optional(
    Schema.Array(
      // Define `subcategories` using recursion
      Schema.suspend((): Schema.Schema<SpaceSystemInfo> => SpaceSystemInfo),
    ),
  ),
});

export const MissionDatabase = Schema.Struct({
  configName: Schema.optional(Schema.String),
  name,
  version: Schema.optional(Schema.String),
  spaceSystems: Schema.Array(SpaceSystemInfo),
  parameterCount: Schema.Number,
  containerCount: Schema.Number,
  commandCount: Schema.Number,
  algorithmCount: Schema.Number,
  parameterTypeCount: Schema.Number,
});

export const CommandId = Schema.String;
export type CommandId = typeof CommandId.Type;

export const CommandIdObject = Schema.Struct({
  generationTime: YamcsDate,
  origin: Schema.String,
  sequenceNumber: Schema.Number,
  commandName: QualifiedName,
});

const FloatValue = Schema.Struct({
  type: Schema.Literal("FLOAT"),
  value: Schema.Number,
}).pipe(Schema.encodeKeys({ value: "floatValue" }));

const DoubleValue = Schema.Struct({
  type: Schema.Literal("DOUBLE"),
  value: Schema.Number,
}).pipe(Schema.encodeKeys({ value: "doubleValue" }));

const Sint32Value = Schema.Struct({
  type: Schema.Literal("SINT32"),
  value: Schema.Number,
}).pipe(Schema.encodeKeys({ value: "sint32Value" }));

const Uint32Value = Schema.Struct({
  type: Schema.Literal("UINT32"),
  value: Schema.Number,
}).pipe(Schema.encodeKeys({ value: "uint32Value" }));

const Sint64Value = Schema.Struct({
  type: Schema.Literal("SINT64"),
  value: Schema.NumberFromString,
}).pipe(Schema.encodeKeys({ value: "sint64Value" }));

const Uint64Value = Schema.Struct({
  type: Schema.Literal("UINT64"),
  value: Schema.Number,
}).pipe(Schema.encodeKeys({ value: "uint64Value" }));

const BinaryValue = Schema.Struct({
  type: Schema.Literal("BINARY"),
  value: Schema.Uint8ArrayFromBase64,
}).pipe(Schema.encodeKeys({ value: "binaryValue" }));

const StringValue = Schema.Struct({
  type: Schema.Literal("STRING"),
  value: Schema.String,
}).pipe(Schema.encodeKeys({ value: "stringValue" }));

const TimestampValue = Schema.Struct({
  type: Schema.Literal("TIMESTAMP"),
  value: YamcsDate,
}).pipe(Schema.encodeKeys({ value: "stringValue" }));

const BooleanValue = Schema.Struct({
  type: Schema.Literal("BOOLEAN"),
  value: Schema.Boolean,
}).pipe(Schema.encodeKeys({ value: "booleanValue" }));

const EnumeratedValueSchema = Schema.Struct({
  type: Schema.Literal("ENUMERATED"),
  value: Schema.String,
}).pipe(Schema.encodeKeys({ value: "stringValue" }));

export interface EnumeratedValue {
  readonly type: "ENUMERATED";
  readonly value: string;
}
export const EnumeratedValue: Schema.Codec<EnumeratedValue, unknown> =
  EnumeratedValueSchema;

export const AggregateValue = Schema.Struct({
  type: Schema.Literal("AGGREGATE"),
});

const ValueSchema = Schema.Union([
  FloatValue,
  DoubleValue,
  Sint32Value,
  Uint32Value,
  Sint64Value,
  Uint64Value,
  BinaryValue,
  StringValue,
  TimestampValue,
  BooleanValue,
  EnumeratedValue,
  AggregateValue,
]);

export type Value =
  | { readonly type: "FLOAT"; readonly value: number }
  | { readonly type: "DOUBLE"; readonly value: number }
  | { readonly type: "SINT32"; readonly value: number }
  | { readonly type: "UINT32"; readonly value: number }
  | { readonly type: "SINT64"; readonly value: number }
  | { readonly type: "UINT64"; readonly value: number }
  | { readonly type: "BINARY"; readonly value: Uint8Array }
  | { readonly type: "STRING"; readonly value: string }
  | { readonly type: "TIMESTAMP"; readonly value: typeof YamcsDate.Type }
  | { readonly type: "BOOLEAN"; readonly value: boolean }
  | EnumeratedValue
  | { readonly type: "AGGREGATE" };
export const Value: Schema.Codec<Value, unknown> = ValueSchema;

const CommandHistoryAttributeSchema = Schema.Struct({
  name: Schema.String,
  value: Value,
});

export type CommandHistoryAttribute = typeof CommandHistoryAttributeSchema.Type;
export const CommandHistoryAttribute: Schema.Codec<
  CommandHistoryAttribute,
  unknown
> = CommandHistoryAttributeSchema;

const CommandAssignmentSchema = Schema.Struct({
  name: Schema.String,
  value: Value,
  userInput: Schema.Boolean,
});

export type CommandAssignment = typeof CommandAssignmentSchema.Type;
export const CommandAssignment: Schema.Codec<CommandAssignment, unknown> =
  CommandAssignmentSchema;

const CommandHistoryEntrySchema = Schema.Struct({
  id: CommandId,
  commandName: QualifiedName,

  aliases: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  origin: Schema.String,
  sequenceNumber: Schema.Number,
  commandId: CommandIdObject,
  attr: Schema.Array(CommandHistoryAttribute),
  generationTime: YamcsDate,
  assignments: Schema.optional(Schema.Array(CommandAssignment)),
});

export type CommandHistoryEntry = typeof CommandHistoryEntrySchema.Type;
export const CommandHistoryEntry: Schema.Codec<CommandHistoryEntry, unknown> =
  CommandHistoryEntrySchema;

const StreamingCommandHisotryEntrySchema = Schema.Struct({
  id: CommandId,
  commandName: QualifiedName,

  aliases: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  origin: Schema.String,
  sequenceNumber: Schema.optional(Schema.Number),
  commandId: CommandIdObject,
  attr: Schema.Array(CommandHistoryAttribute),
  generationTime: YamcsDate,
  assignments: Schema.optional(Schema.Array(CommandAssignment)),
});

export type StreamingCommandHisotryEntry =
  typeof StreamingCommandHisotryEntrySchema.Type;
export const StreamingCommandHisotryEntry: Schema.Codec<
  StreamingCommandHisotryEntry,
  unknown
> = StreamingCommandHisotryEntrySchema;

/**
 * Represents a request to issue a command within the system.
 */
export const IssueCommandRequest = Schema.Struct({
  /**
   * The name/value assignments for this command.
   */
  args: Schema.optional(Schema.Record(Schema.String, Schema.Any)),

  /**
   * The origin of the command. Typically a hostname.
   */
  origin: Schema.optional(Schema.String),

  /**
   * The sequence number as specified by the origin.
   * This value is communicated back in command history and
   * command queue entries, allowing clients to map
   * local to remote command identities.
   */
  sequenceNumber: Schema.optional(Schema.Number),

  /**
   * Comment attached to this command.
   */
  comment: Schema.optional(Schema.String),

  /**
   * Custom command options registered on the server.
   */
  extra: Schema.optional(Schema.Record(Schema.String, Schema.Any)),

  /**
   * Override the stream on which the command should be sent out.
   *
   * Requires elevated privilege.
   */
  stream: Schema.optional(Schema.String),
});

const IssueCommandResponseSchema = Schema.Struct({
  id: CommandId,
  generationTime: YamcsDate,
  origin: Schema.String,
  sequenceNumber: Schema.Number,
  commandName: QualifiedName,
  assignments: Schema.Array(CommandAssignment),
  unprocessedBinary: Schema.Uint8ArrayFromBase64,
  binary: Schema.Uint8ArrayFromBase64,
  username: Schema.String,
  queue: Schema.String,
});

export type IssueCommandResponse = typeof IssueCommandResponseSchema.Type;
export const IssueCommandResponse: Schema.Codec<IssueCommandResponse, unknown> =
  IssueCommandResponseSchema;

export const ActionInfo = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  style: Schema.Literals(["PUSH_BUTTON", "CHECK_BOX"]),
  enabled: Schema.Boolean,
  checked: Schema.Boolean,
});

export const LinkInfo = Schema.Struct({
  instance: Schema.String,
  name: Schema.String,
  type: Schema.String,
  spec: Schema.optional(Schema.String),
  disabled: Schema.Boolean,
  status: Schema.String,
  dataInCount: Schema.NumberFromString,
  dataOutCount: Schema.NumberFromString,
  detailedStatus: Schema.optional(Schema.String),
  parentName: Schema.optional(Schema.String),
  actions: Schema.optional(Schema.Array(ActionInfo)),
  parameters: Schema.optional(Schema.Array(QualifiedName)),
});

export const ParameterSample = Schema.Struct({
  time: YamcsDate,
  avg: Schema.optional(Schema.Number),
  min: Schema.optional(Schema.Number),
  max: Schema.optional(Schema.Number),
  n: Schema.optional(Schema.Number),
  minTime: Schema.optional(YamcsDate),
  maxTime: Schema.optional(YamcsDate),
  firstTime: Schema.optional(YamcsDate),
  lastTime: Schema.optional(YamcsDate),
});

export const EventSeverity = Schema.Literals([
  "INFO",
  "ERROR",
  "WATCH",
  "WARNING",
  "WARNING_NEW",
  "DISTRESS",
  "CRITICAL",
  "SEVERE",
]);

export const Event = Schema.Struct({
  source: Schema.String,
  generationTime: YamcsDate,
  receptionTime: YamcsDate,
  seqNumber: Schema.Number,
  type: Schema.optional(Schema.String),
  message: Schema.String,
  severity: EventSeverity,
  createdBy: Schema.optional(Schema.String),
  extra: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

export const ConsequenceLevel = Schema.Literals([
  // All commands which are not in a category below
  "NONE",

  // ISO 14490: telecommand that, if executed at the wrong time or in the
  // wrong configuration, could cause irreversible loss or damage for the
  // mission (i.e. endanger the achievement of the primary mission objectives)
  "CRITICAL",

  // ISO 14490: telecommand that is not a critical telecommand but is essential
  // to the success of the mission and, if sent at the wrong time, could cause
  // momentary loss of the mission
  "DISTRESS",

  // ISO 14490: telecommand that is not expected to be used for nominal or
  // foreseeable contingency operations, that is included for unforeseen contingency
  // operations, and that could cause irreversible damage if executed at the wrong
  // time or in the wrong configuration
  "SEVERE",

  // Mission specific
  "WARNING",

  // Mission specific
  "WATCH",
]);

export const CommandInfo = Schema.Struct({
  name: Schema.String,
  qualifiedName: Schema.String,
  shortDescription: Schema.optional(Schema.String),
  longDescription: Schema.optional(Schema.String),
  significance: Schema.optional(
    Schema.Struct({ consequenceLevel: ConsequenceLevel }),
  ),
});

export const OperatorType = Schema.Literals([
  "EQUAL_TO",
  "NOT_EQUAL_TO",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL_TO",
  "SMALLER_THAN",
  "SMALLER_THAN_OR_EQUAL_TO",
]);

export const ReferenceLocationType = Schema.Literals([
  "CONTAINER_START",
  "PREVIOUS_ENTRY",
]);

export const ArgumentTypeInfo = Schema.Struct({
  name: Schema.String,
  engType: Schema.String,
});

export const ArgumentInfo = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  initialValue: Schema.String,
  type: ArgumentTypeInfo,
});

export const FixedValueInfo = Schema.Struct({
  name: Schema.String,
  hexValue: Schema.String,
  sizeInBits: Schema.Number,
});

export const RepeatInfo = Schema.Struct({
  fixedCount: Schema.String, // String decimal
  // dynamicCount: Schema.suspend(() => ParameterInfo),
  bitsBetween: Schema.Number,
});

export const IndirectParameterRefInfo = Schema.Struct({
  // parameter: Schema.suspend(() => ParameterInfo),
  aliasNamespace: Schema.String,
});

export const ComparisonInfo = Schema.Struct({
  // parameter: Schema.suspend(() => ParameterInfo),
  operator: OperatorType,
  value: Schema.String,
  argument: ArgumentInfo,
});

export class ContainerInfo extends Schema.Opaque<ContainerInfo>()(
  Schema.Struct({
    name,
    qualifiedName,
    shortDescription,
    longDescription,
    alias,
    maxInterval: Schema.String,
    sizeInBits: Schema.Number,
    restrictionCriteria: Schema.Array(ComparisonInfo),
    restrictionCriteriaExpression: Schema.String,
    entry: Schema.Array(
      Schema.suspend((): Schema.Codec<SequenceEntryInfo> => SequenceEntryInfo),
    ),
    usedBy: Schema.Any,
    ancillaryData: Schema.Record(Schema.String, Schema.String),
    archivePartition: Schema.Boolean,
    baseContainer: Schema.suspend(
      (): Schema.Codec<ContainerInfo> => ContainerInfo,
    ),
  }),
) {}

export class SequenceEntryInfo extends Schema.Opaque<SequenceEntryInfo>()(
  Schema.Struct({
    locationInBits: Schema.Number,
    referenceLocation: ReferenceLocationType,
    container: Schema.optional(ContainerInfo),
    // parameter: Schema.suspend(() => ParameterInfo),
    argument: ArgumentInfo,
    fixedValue: FixedValueInfo,
    repeat: RepeatInfo,
    indirectParameterRef: IndirectParameterRefInfo,
  }),
) {}

export const YamcsInstance = Schema.Struct({
  // Instance name.
  name: Schema.String,
  missionDatabase: MissionDatabase,
  // processors: Schema.Array(ProcessorInfo);
  // state: InstanceState;

  //in case the state=FAILED, this field will indicate the cause of the failure
  // the missionDatabase and other fields may not be filled when this happens
  failureCause: Schema.optional(Schema.String),
});
