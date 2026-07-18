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
  type: Schema.Literals(["POLYNOMIAL", "SPLINE", "MATH_OPERATION", "JAVA_EXPRESSION", "ALGORITHM"]),
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

export const AlarmLevelType = Schema.Literals([
  "NORMAL",
  "WATCH",
  "WARNING",
  "DISTRESS",
  "CRITICAL",
  "SEVERE",
]);

export const AlarmRange = Schema.Struct({
  level: AlarmLevelType,
  minInclusive: Schema.optional(Schema.Number),
  maxInclusive: Schema.optional(Schema.Number),
  minExclusive: Schema.optional(Schema.Number),
  maxExclusive: Schema.optional(Schema.Number),
});

export const EnumerationAlarm = Schema.Struct({
  level: AlarmLevelType,
  label: Schema.String,
});

export const AlarmInfo = Schema.Struct({
  minViolations: Schema.optional(Schema.Number),
  staticAlarmRange: Schema.optional(Schema.Array(AlarmRange)),
  staticAlarmRanges: Schema.optional(Schema.Array(AlarmRange)),
  enumerationAlarm: Schema.optional(Schema.Array(EnumerationAlarm)),
  enumerationAlarms: Schema.optional(Schema.Array(EnumerationAlarm)),
  defaultLevel: Schema.optional(AlarmLevelType),
});

const AlgorithmSummaryInfo = Schema.Struct({
  name,
  qualifiedName,
  shortDescription,
  longDescription,
  alias,
  scope: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String),
});

const ContainerSummaryInfo = Schema.Struct({
  name,
  qualifiedName,
  shortDescription,
  longDescription,
  alias,
});

export const UsedByInfo = Schema.Struct({
  algorithm: Schema.optional(Schema.Array(AlgorithmSummaryInfo)),
  container: Schema.optional(Schema.Array(ContainerSummaryInfo)),
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
  defaultAlarm: Schema.optional(AlarmInfo),
  sizeInBits: Schema.optional(Schema.Int),
  signed: Schema.optional(Schema.Boolean),
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
  usedBy: Schema.optional(UsedByInfo),
  // ancillaryData: {[key: string]: AncillaryDataInfo},
  path: Schema.optional(Schema.Array(Schema.String)),
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

export const SpaceSystemInfo: Schema.Codec<SpaceSystemInfo> = Schema.Struct({
  ...spaceSystemInfoFields,
  sub: Schema.optional(
    Schema.Array(
      // Recursive schemas should suspend a concrete codec, not the type-only Schema view.
      Schema.suspend((): Schema.Codec<SpaceSystemInfo> => SpaceSystemInfo),
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
export const EnumeratedValue: Schema.Codec<EnumeratedValue, unknown> = EnumeratedValueSchema;

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

export const SetParameterValueRequest = Schema.Struct({
  id: NamedObjectId,
  value: Value,
  generationTime: Schema.optional(Schema.String),
  expiresIn: Schema.optional(Schema.String),
});

export const BatchSetParameterValuesRequest = Schema.Struct({
  request: Schema.Array(SetParameterValueRequest),
});

const CommandHistoryAttributeSchema = Schema.Struct({
  name: Schema.String,
  value: Value,
});

export type CommandHistoryAttribute = typeof CommandHistoryAttributeSchema.Type;
export const CommandHistoryAttribute: Schema.Codec<CommandHistoryAttribute, unknown> =
  CommandHistoryAttributeSchema;

const CommandAssignmentSchema = Schema.Struct({
  name: Schema.String,
  value: Value,
  userInput: Schema.Boolean,
});

export type CommandAssignment = typeof CommandAssignmentSchema.Type;
export const CommandAssignment: Schema.Codec<CommandAssignment, unknown> = CommandAssignmentSchema;

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

export type StreamingCommandHisotryEntry = typeof StreamingCommandHisotryEntrySchema.Type;
export const StreamingCommandHisotryEntry: Schema.Codec<StreamingCommandHisotryEntry, unknown> =
  StreamingCommandHisotryEntrySchema;

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
  assignments: Schema.optional(Schema.Array(CommandAssignment)),
  unprocessedBinary: Schema.Uint8ArrayFromBase64,
  binary: Schema.Uint8ArrayFromBase64,
  username: Schema.String,
  queue: Schema.String,
});

export type IssueCommandResponse = typeof IssueCommandResponseSchema.Type;
export const IssueCommandResponse: Schema.Codec<IssueCommandResponse, unknown> =
  IssueCommandResponseSchema;

export const Advancement = Schema.Struct({
  acknowledgment: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed("Acknowledge_Queued")),
  ),
  wait: Schema.optional(Schema.Number),
});

export type JsonPrimitive = string | number | boolean;
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | ReadonlyArray<JsonValue> | JsonObject;

export const JsonValue: Schema.Schema<JsonValue> = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.suspend((): Schema.Schema<JsonValue> => JsonValue)),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Schema<JsonValue> => JsonValue),
  ),
]);

export const TextStep = Schema.Struct({
  type: Schema.Literal("text"),
  comment: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  stepNumber: Schema.optional(Schema.Number),
  text: Schema.String,
});

export const NoteStep = Schema.Struct({
  type: Schema.Literal("note"),
  comment: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  stepNumber: Schema.optional(Schema.Number),
  text: Schema.String,
  color: Schema.optional(Schema.String),
});

export const CheckStep = Schema.Struct({
  type: Schema.Literal("check"),
  comment: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  stepNumber: Schema.optional(Schema.Number),
  parameters: Schema.Array(
    Schema.Struct({
      parameter: Schema.String,
    }),
  ),
});

export const VerifyCondition = Schema.Struct({
  parameter: Schema.String,
  operator: Schema.Literals(["eq", "neq", "le", "lte", "gt", "gte"]),
  value: JsonValue,
  display: Schema.optional(
    Schema.Struct({
      row: Schema.optional(Schema.String),
      column: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
    }),
  ),
});

export const VerifyPresentationColumn = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
});

export const VerifyPresentation = Schema.Struct({
  type: Schema.Literal("truthTable"),
  columns: Schema.Array(VerifyPresentationColumn),
});

export const VerifyStep = Schema.Struct({
  type: Schema.Literal("verify"),
  comment: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  stepNumber: Schema.optional(Schema.Number),
  condition: Schema.Array(VerifyCondition),
  presentation: Schema.optional(VerifyPresentation),
  delay: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
  timeout: Schema.optional(Schema.Int),
});

export const ProcedureCommand = Schema.Struct({
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
        value: Schema.optional(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
      }),
    ),
  ),
  stream: Schema.optional(Schema.String),
  advancement: Schema.optional(Advancement),
});

const CommandStepBaseFields = {
  type: Schema.Literal("command"),
  comment: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  stepNumber: Schema.optional(Schema.Number),
} as const;

export const CommandStep = Schema.Union([
  Schema.Struct({
    ...CommandStepBaseFields,
    ...ProcedureCommand.fields,
  }),
  Schema.Struct({
    ...CommandStepBaseFields,
    commands: Schema.NonEmptyArray(ProcedureCommand),
  }),
]);

export const ProcedureStep = Schema.Union([TextStep, NoteStep, CheckStep, VerifyStep, CommandStep]);

export const ProcedureStack = Schema.Struct({
  steps: Schema.Array(ProcedureStep),
  advancement: Schema.optional(Advancement),
});

export type ProcedureStack = typeof ProcedureStack.Type;

export const YamcsStack = ProcedureStack;

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
  significance: Schema.optional(Schema.Struct({ consequenceLevel: ConsequenceLevel })),
});

export const OperatorType = Schema.Literals([
  "EQUAL_TO",
  "NOT_EQUAL_TO",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL_TO",
  "SMALLER_THAN",
  "SMALLER_THAN_OR_EQUAL_TO",
]);

export const ReferenceLocationType = Schema.Literals(["CONTAINER_START", "PREVIOUS_ENTRY"]);

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
    entry: Schema.Array(Schema.suspend((): Schema.Codec<SequenceEntryInfo> => SequenceEntryInfo)),
    usedBy: Schema.Any,
    ancillaryData: Schema.Record(Schema.String, Schema.String),
    archivePartition: Schema.Boolean,
    baseContainer: Schema.suspend((): Schema.Codec<ContainerInfo> => ContainerInfo),
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

export const AlarmType = Schema.Literals(["PARAMETER", "EVENT"]);

export const AlarmSeverity = Schema.Literals([
  "WATCH",
  "WARNING",
  "DISTRESS",
  "CRITICAL",
  "SEVERE",
]);

export const AlarmNotificationType = Schema.Literals([
  "ACTIVE",
  "TRIGGERED",
  "SEVERITY_INCREASED",
  "VALUE_UPDATED",
  "ACKNOWLEDGED",
  "CLEARED",
  "RTN",
  "SHELVED",
  "UNSHELVED",
  "RESET",
  "TRIGGERED_PENDING",
]);

export const AcquisitionStatus = Schema.Literals([
  "ACQUIRED",
  "NOT_RECEIVED",
  "INVALID",
  "EXPIRED",
]);

export const MonitoringResult = Schema.Literals([
  "DISABLED",
  "IN_LIMITS",
  "WATCH",
  "WARNING",
  "DISTRESS",
  "CRITICAL",
  "SEVERE",
]);

export const RangeCondition = Schema.Literals(["LOW", "HIGH"]);

export const AlarmParameterValue = Schema.Struct({
  id: NamedObjectId,
  rawValue: Schema.optional(Value),
  engValue: Schema.optional(Value),
  acquisitionTime: Schema.optional(YamcsDate),
  generationTime: YamcsDate,
  acquisitionStatus: Schema.optional(AcquisitionStatus),
  processingStatus: Schema.optional(Schema.Boolean),
  monitoringResult: Schema.optional(MonitoringResult),
  rangeCondition: Schema.optional(RangeCondition),
  alarmRange: Schema.optional(Schema.Array(AlarmRange)),
  expireMillis: Schema.optional(Schema.NumberFromString),
  numericId: Schema.optional(Schema.Number),
});

export const AcknowledgeInfo = Schema.Struct({
  acknowledgedBy: Schema.optional(Schema.String),
  acknowledgeMessage: Schema.optional(Schema.String),
  acknowledgeTime: Schema.optional(YamcsDate),
});

export const ParameterAlarmData = Schema.Struct({
  triggerValue: AlarmParameterValue,
  mostSevereValue: AlarmParameterValue,
  currentValue: AlarmParameterValue,
  parameter: Schema.optional(ParameterInfo),
});

export const EventAlarmData = Schema.Struct({
  triggerEvent: Event,
  mostSevereEvent: Event,
  currentEvent: Event,
});

export const ShelveInfo = Schema.Struct({
  shelvedBy: Schema.optional(Schema.String),
  shelveMessage: Schema.optional(Schema.String),
  shelveTime: Schema.optional(YamcsDate),
  shelveExpiration: Schema.optional(YamcsDate),
});

export const ClearInfo = Schema.Struct({
  clearedBy: Schema.optional(Schema.String),
  clearTime: Schema.optional(YamcsDate),
  clearMessage: Schema.optional(Schema.String),
});

export const AlarmData = Schema.Struct({
  type: AlarmType,
  triggerTime: YamcsDate,
  id: NamedObjectId,
  seqNum: Schema.Number,
  severity: AlarmSeverity,
  violations: Schema.Number,
  count: Schema.Number,
  acknowledgeInfo: Schema.optional(AcknowledgeInfo),
  notificationType: AlarmNotificationType,
  parameterDetail: Schema.optional(ParameterAlarmData),
  eventDetail: Schema.optional(EventAlarmData),
  latching: Schema.optional(Schema.Boolean),
  processOK: Schema.Boolean,
  triggered: Schema.Boolean,
  acknowledged: Schema.Boolean,
  shelveInfo: Schema.optional(ShelveInfo),
  clearInfo: Schema.optional(ClearInfo),
  updateTime: Schema.optional(YamcsDate),
  readonly: Schema.Boolean,
  pending: Schema.Boolean,
});
