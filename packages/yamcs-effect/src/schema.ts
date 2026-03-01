import { ParseResult, Schema } from "effect";

export const NamedObjectId = Schema.Struct({
  name: Schema.String,
  namespace: Schema.optional(Schema.String),
});

export const QualifiedName = Schema.String;
export type QualifiedName = typeof Schema.String.Type;

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

export const PolynomialCalibratorInfo = Schema.TaggedStruct("POLYNOMIAL", {
  coefficients: Schema.Array(Schema.Number),
});

export const SplinePointInfo = Schema.Struct({
  raw: Schema.Number,
  calibrated: Schema.Number,
});

export const SplineCalibratorInfo = Schema.TaggedStruct("SPLINE", {
  points: Schema.Array(SplinePointInfo),
});

export const JavaExpressionCalibratorInfo = Schema.TaggedStruct("JAVA_EXPRESSION", {
  formula: Schema.String,
});

export const MathOperationCalibratorInfo = Schema.TaggedStruct("MATH_OPERATION", {});

export const CalibratorInfo = Schema.transformOrFail(
  // Source
  Schema.Struct({
    type: Schema.Literal("POLYNOMIAL", "SPLINE", "MATH_OPERATION", "JAVA_EXPRESSION", "ALGORITHM"),
    polynomialCalibrator: Schema.optional(PolynomialCalibratorInfo),
    splineCalibrator: Schema.optional(SplineCalibratorInfo),
    javaExpressionCalibrator: Schema.optional(JavaExpressionCalibratorInfo),
  }),
  // Target
  Schema.Union(
    JavaExpressionCalibratorInfo,
    SplineCalibratorInfo,
    PolynomialCalibratorInfo,
    MathOperationCalibratorInfo,
  ),
  {
    strict: true,
    decode: (input) => {
      switch (input.type) {
        case "SPLINE":
          return ParseResult.succeed(input.splineCalibrator!);
        case "POLYNOMIAL":
          return ParseResult.succeed(input.polynomialCalibrator!);
        case "JAVA_EXPRESSION":
          return ParseResult.succeed(input.javaExpressionCalibrator!);
        case "MATH_OPERATION":
          return ParseResult.succeed(MathOperationCalibratorInfo.make());
        default:
          return ParseResult.fail(
            new ParseResult.Unexpected(input.type, "Couldn't decode unknown calibrator"),
          );
      }
    },
    // Encode: Forbid reversing the hashed password back to plain text
    encode: (initial, _, ast) =>
      ParseResult.fail(
        new ParseResult.Forbidden(
          ast,
          initial,
          "Encoding back into an API response is not supported at this time.",
        ),
      ),
  },
);

export const DataEncodingType = Schema.Literal("BINARY", "BOOLEAN", "FLOAT", "INTEGER", "STRING");

export const DataEncodingInfo = Schema.Struct({
  type: DataEncodingType,
  littleEndian: Schema.optional(Schema.Boolean),
  sizeInBits: Schema.optional(Schema.NonNegativeInt),
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

export const DataSourceType = Schema.Literal(
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
);

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

export interface SpaceSystemInfo extends Schema.Struct.Type<typeof spaceSystemInfoFields> {
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
  generationTime: Schema.DateFromString,
  origin: Schema.String,
  sequenceNumber: Schema.Number,
  commandName: QualifiedName,
});

const FloatValue = Schema.Struct({
  type: Schema.Literal("FLOAT"),
  value: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey("floatValue")),
});

const DoubleValue = Schema.Struct({
  type: Schema.Literal("DOUBLE"),
  value: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey("doubleValue")),
});

const Sint32Value = Schema.Struct({
  type: Schema.Literal("SINT32"),
  value: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey("sint32Value")),
});

const Uint32Value = Schema.Struct({
  type: Schema.Literal("UINT32"),
  value: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey("uint32Value")),
});

const Sint64Value = Schema.Struct({
  type: Schema.Literal("SINT64"),
  value: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey("sint64Value")),
});

const Uint64Value = Schema.Struct({
  type: Schema.Literal("UINT64"),
  value: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey("uint64Value")),
});

const BinaryValue = Schema.Struct({
  type: Schema.Literal("BINARY"),
  value: Schema.propertySignature(Schema.Uint8ArrayFromBase64).pipe(Schema.fromKey("binaryValue")),
});

const StringValue = Schema.Struct({
  type: Schema.Literal("STRING"),
  value: Schema.propertySignature(Schema.String).pipe(Schema.fromKey("stringValue")),
});

const TimestampValue = Schema.Struct({
  type: Schema.Literal("TIMESTAMP"),
  value: Schema.propertySignature(Schema.DateFromString).pipe(Schema.fromKey("stringValue")),
});

const BooleanValue = Schema.Struct({
  type: Schema.Literal("BOOLEAN"),
  value: Schema.propertySignature(Schema.Boolean).pipe(Schema.fromKey("booleanValue")),
});

export const EnumeratedValue = Schema.Struct({
  type: Schema.Literal("ENUMERATED"),
  value: Schema.propertySignature(Schema.String).pipe(Schema.fromKey("stringValue")),
});

export const AggregateValue = Schema.Struct({
  type: Schema.Literal("AGGREGATE"),
});

export const Value = Schema.Union(
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
);

export const CommandHistoryAttribute = Schema.Struct({
  name: Schema.String,
  value: Value,
});

export const CommandAssignment = Schema.Struct({
  name: Schema.String,
  value: Value,
  userInput: Schema.Boolean,
});

export const CommandHistoryEntry = Schema.Struct({
  id: CommandId,
  commandName: QualifiedName,

  aliases: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  origin: Schema.String,
  sequenceNumber: Schema.Number,
  commandId: CommandIdObject,
  attr: Schema.Array(CommandHistoryAttribute),
  generationTime: Schema.DateFromString,
  assignments: Schema.optional(Schema.Array(CommandAssignment)),
});

export const StreamingCommandHisotryEntry = Schema.Struct({
  id: CommandId,
  commandName: QualifiedName,

  aliases: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  origin: Schema.String,
  sequenceNumber: Schema.optional(Schema.Number),
  commandId: CommandIdObject,
  attr: Schema.Array(CommandHistoryAttribute),
  generationTime: Schema.DateFromString,
  assignments: Schema.optional(Schema.Array(CommandAssignment)),
});

/**
 * Represents a request to issue a command within the system.
 */
export const IssueCommandRequest = Schema.Struct({
  /**
   * The name/value assignments for this command.
   */
  args: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),

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
   * Override the stream on which the command should be sent out.
   *
   * Requires elevated privilege.
   */
  stream: Schema.optional(Schema.String),
});

export const IssueCommandResponse = Schema.Struct({
  id: CommandId,
  generationTime: Schema.DateFromString,
  origin: Schema.String,
  sequenceNumber: Schema.Number,
  commandName: QualifiedName,
  assignments: Schema.Array(CommandAssignment),
  unprocessedBinary: Schema.Uint8ArrayFromBase64,
  binary: Schema.Uint8ArrayFromBase64,
  username: Schema.String,
  queue: Schema.String,
});

export const ActionInfo = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  style: Schema.Literal("PUSH_BUTTON", "CHECK_BOX"),
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
  time: Schema.DateFromString,
  avg: Schema.Number,
  min: Schema.Number,
  max: Schema.Number,
  n: Schema.Number,
  minTime: Schema.DateFromString,
  maxTime: Schema.DateFromString,
  firstTime: Schema.DateFromString,
  lastTime: Schema.DateFromString,
});

export const EventSeverity = Schema.Literal(
  "INFO",
  "WATCH",
  "WARNING",
  "DISTRESS",
  "CRITICAL",
  "SEVERE",
);

export const Event = Schema.Struct({
  source: Schema.String,
  generationTime: Schema.DateFromString,
  receptionTime: Schema.DateFromString,
  seqNumber: Schema.Number,
  message: Schema.String,
  severity: EventSeverity,
});

export const CommandInfo = Schema.Struct({
  name: Schema.String,
  qualifiedName: Schema.String,
  shortDescription: Schema.optional(Schema.String),
  longDescription: Schema.optional(Schema.String),
});
