import type { AtomRegistry as AtomRegistryType } from "effect/unstable/reactivity";

import {
  type QualifiedName,
  CommandHistoryEvent,
  ProcedureStep,
  StreamingCommandHisotryEntry,
  Parameters,
  YamcsConfig,
  YamcsWebSocketClient,
} from "@mrt/yamcs-effect";
import {
  Cause,
  Context,
  Data,
  DateTime,
  Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";

import { commandsSubscriptionAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { stringifyValue } from "@/lib/utils";

import { TW1 } from "./procedures/tw1";

const ExecutionStepState = Schema.Literals(["initial", "running", "completed", "failed"]);
type ExecutionStepState = typeof ExecutionStepState.Type;

class EmptyStepLiveData extends Schema.TaggedClass<EmptyStepLiveData>()("EmptyStepLiveData", {}) {}

export class CommandStepLiveData extends Schema.TaggedClass<CommandStepLiveData>()(
  "CommandStepLiveData",
  {
    command: StreamingCommandHisotryEntry,
  },
) {}

const VerifyConditionStatusSchema = Schema.Literals(["pending", "passed"]);
type VerifyConditionStatus = typeof VerifyConditionStatusSchema.Type;

class VerifyConditionLiveData extends Schema.Class<VerifyConditionLiveData>(
  "VerifyConditionLiveData",
)({
  label: Schema.String,
  parameter: Schema.String,
  mirroredParameter: Schema.optional(Schema.String),
  operator: Schema.String,
  expected: Schema.String,
  actual: Schema.NullOr(Schema.String),
  status: VerifyConditionStatusSchema,
  mirroredActual: Schema.NullOr(Schema.String),
  mirroredStatus: Schema.optional(VerifyConditionStatusSchema),
}) {}

export class VerifyStepLiveData extends Schema.TaggedClass<VerifyStepLiveData>()(
  "VerifyStepLiveData",
  {
    conditions: Schema.Array(VerifyConditionLiveData),
  },
) {}

const StepLiveData = Schema.Union([EmptyStepLiveData, CommandStepLiveData, VerifyStepLiveData]);
type StepLiveData = typeof StepLiveData.Type;

type CommandHistoryEntry = (typeof CommandHistoryEvent.Type)["data"];
type VerifyStep = Extract<typeof ProcedureStep.Type, { type: "verify" }>;
type VerifyCondition = VerifyStep["condition"][number];

interface SelectedCommandStep {
  readonly stepIndex: number;
  readonly commandName: string;
  readonly selectedAt: DateTime.Utc;
  readonly trackedCommandId: string | null;
}

const ProcedureAuditEventType = Schema.Literals([
  "stepSelected",
  "stepExecutionStarted",
  "stepLiveMessageUpdated",
  "stepLiveDataUpdated",
  "stepCompleted",
  "stepFailed",
]);
type ProcedureAuditEventType = typeof ProcedureAuditEventType.Type;

export class ExecutionStep extends Schema.Class<ExecutionStep>("ExecutionStep")({
  state: ExecutionStepState,
  isSelected: Schema.Boolean,
  liveMessage: Schema.NullOr(Schema.String),
  liveData: StepLiveData,
  meta: ProcedureStep,
}) {
  static readonly fromProcedureStep = (step: typeof ProcedureStep.Type, index: number) =>
    ExecutionStep.make({
      state: "initial",
      isSelected: index === 0,
      liveMessage: null,
      liveData: new EmptyStepLiveData(),
      meta: step,
    });
}

const formatStepDisplayNumber = (step: ExecutionStep) =>
  step.meta.stepNumber === undefined
    ? `#${step.meta.type}@${step.meta.role}`
    : `${step.meta.stepNumber}`;

class ProcedureAuditEntry extends Schema.Class<ProcedureAuditEntry>("ProcedureAuditEntry")({
  at: Schema.DateTimeUtc,
  event: ProcedureAuditEventType,
  stepIndex: Schema.Number,
  stepNumber: Schema.NullOr(Schema.Number),
  stepDisplayNumber: Schema.String,
  message: Schema.String,
  liveData: StepLiveData,
}) {}

const makeAuditEntry = (
  at: DateTime.Utc,
  stepIndex: number,
  step: ExecutionStep,
  event: ProcedureAuditEventType,
  message: string,
  liveData: StepLiveData = step.liveData,
) =>
  ProcedureAuditEntry.make({
    at,
    event,
    stepIndex,
    stepNumber: step.meta.stepNumber ?? null,
    stepDisplayNumber: formatStepDisplayNumber(step),
    message,
    liveData,
  });

export class ProcedureExecutorLog extends Context.Service<
  ProcedureExecutorLog,
  {
    readonly entries: SubscriptionRef.SubscriptionRef<ReadonlyArray<ProcedureAuditEntry>>;
    readonly append: (entry: ProcedureAuditEntry) => Effect.Effect<void>;
    readonly renderText: Effect.Effect<string>;
  }
>()("@mrt/frontend/ProcedureExecutorLog") {
  static readonly layer = Layer.effect(
    ProcedureExecutorLog,
    Effect.gen(function* () {
      const entries = yield* SubscriptionRef.make<ReadonlyArray<ProcedureAuditEntry>>([]);

      const append = (entry: ProcedureAuditEntry) =>
        SubscriptionRef.update(entries, (current) => [...current, entry]);

      const renderText = Effect.map(SubscriptionRef.get(entries), (entries) =>
        entries
          .map(
            (entry) =>
              `${DateTime.toDate(entry.at).toISOString()} | ${entry.event} | stepIndex=${entry.stepIndex} | stepNumber=${entry.stepDisplayNumber} | ${entry.message}`,
          )
          .join("\n"),
      );

      return { entries, append, renderText };
    }),
  );
}

export class ProcedureExecutionState extends Schema.Class<ProcedureExecutionState>(
  "ProcedureExecutionState",
)({
  currentStepIndex: Schema.Number,
  steps: Schema.Array(ExecutionStep),
}) {}

const updateStepAt = (
  steps: ReadonlyArray<ExecutionStep>,
  index: number,
  f: (step: ExecutionStep) => ExecutionStep,
): ReadonlyArray<ExecutionStep> =>
  steps.map((step, stepIndex) => (stepIndex === index ? f(step) : step));

const setStepState = (step: ExecutionStep, state: ExecutionStepState) =>
  ExecutionStep.make({
    ...step,
    state,
  });

const setStepSelected = (step: ExecutionStep, isSelected: boolean) =>
  ExecutionStep.make({
    ...step,
    isSelected,
  });

const setStepLiveMessage = (step: ExecutionStep, liveMessage: string | null) =>
  ExecutionStep.make({
    ...step,
    liveMessage,
  });

const setStepLiveData = (step: ExecutionStep, liveData: StepLiveData) =>
  ExecutionStep.make({
    ...step,
    liveData,
  });

const formatAttrValue = (attr: {
  readonly value: { readonly type: string; readonly stringValue?: string };
}) => attr.value.stringValue ?? attr.value.type;

const formatCommandLiveMessage = (entry: CommandHistoryEntry) =>
  entry.attr.map((attr) => `${attr.name}: ${formatAttrValue(attr)}`).join("\n");

const getCommandAttributeValue = (entry: CommandHistoryEntry, name: string) =>
  entry.attr.find((attr) => attr.name === name)?.value;

const isTerminalCommandEntry = (entry: CommandHistoryEntry) =>
  entry.attr.some(
    (attr) =>
      attr.name === "CommandComplete_Status" &&
      attr.value.type === "STRING" &&
      (attr.value.value === "OK" || attr.value.value === "NOK"),
  );

class ProcedureStepTimeoutError extends Data.TaggedError("ProcedureStepTimeoutError")<{
  readonly message: string;
}> {}

class ProcedureCommandFailedError extends Data.TaggedError("ProcedureCommandFailedError")<{
  readonly message: string;
}> {}

const timeoutStepCompletion = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  duration: Duration.Input = "15 seconds",
) =>
  effect.pipe(
    Effect.timeoutOrElse({
      duration,
      orElse: () =>
        Effect.fail(
          new ProcedureStepTimeoutError({
            message: `Timed out waiting for step completion after ${duration}`,
          }),
        ),
    }),
  );

const timeoutCommandCompletion = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  timeoutStepCompletion(effect, "15 seconds");

const clampStepIndex = (steps: ReadonlyArray<ExecutionStep>, index: number): number => {
  if (steps.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, steps.length - 1));
};

const isCommandExecutionStep = (
  step: ExecutionStep | undefined,
): step is ExecutionStep & {
  readonly meta: Extract<typeof ProcedureStep.Type, { type: "command" }>;
} => step?.meta.type === "command";

const formatVerifyOperator = (operator: VerifyCondition["operator"]) => {
  switch (operator) {
    case "eq":
      return "==";
    case "neq":
      return "!=";
    case "gt":
      return ">";
    case "gte":
      return ">=";
    case "le":
      return "<";
    case "lte":
      return "<=";
  }
};

const formatJsonValue = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(formatJsonValue).join(", ")}]`;
  }

  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, entry]) => `${key}: ${formatJsonValue(entry)}`)
      .join(", ")}}`;
  }

  return String(value);
};

const getParameterLeafName = (qualifiedName: QualifiedName) => {
  const segments = qualifiedName.split("/").filter(Boolean);
  return segments.at(-1) ?? qualifiedName;
};

const getMirroredParameterName = (qualifiedName: QualifiedName): QualifiedName | undefined =>
  qualifiedName.includes("SystemA")
    ? (qualifiedName.replace("SystemA", "SystemB") as QualifiedName)
    : undefined;

const formatVerifyConditionLabel = (step: VerifyStep, condition: VerifyCondition) => {
  if (condition.display?.label) {
    return condition.display.label;
  }

  const row = condition.display?.row;
  const columnId = condition.display?.column;
  const columnLabel =
    step.presentation?.type === "truthTable" && columnId
      ? step.presentation.columns.find((column) => column.id === columnId)?.label
      : undefined;

  if (row || columnLabel || columnId) {
    return [row, columnLabel ?? columnId].filter((part) => part && part.length > 0).join(" ");
  }

  return getParameterLeafName(condition.parameter).replaceAll("_", " ");
};

const makeVerifyConditionLiveData = (step: VerifyStep, condition: VerifyCondition) =>
  VerifyConditionLiveData.make({
    label: formatVerifyConditionLabel(step, condition),
    parameter: condition.parameter,
    mirroredParameter: getMirroredParameterName(condition.parameter),
    operator: formatVerifyOperator(condition.operator),
    expected: formatJsonValue(condition.value),
    actual: null,
    status: "pending",
    mirroredActual: null,
    mirroredStatus: getMirroredParameterName(condition.parameter) ? "pending" : undefined,
  });

const valueToComparable = (
  value: { readonly type: string; readonly value?: unknown } | undefined,
): unknown => {
  if (!value || !("value" in value)) {
    return undefined;
  }

  return value.value;
};

const jsonValueEquals = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => jsonValueEquals(entry, right[index]))
    );
  }

  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);

    return (
      leftEntries.length === rightEntries.length &&
      leftEntries.every(([key, entry]) =>
        jsonValueEquals(entry, (right as Record<string, unknown>)[key]),
      )
    );
  }

  return false;
};

const compareVerifyCondition = (actual: unknown, condition: VerifyCondition): boolean => {
  switch (condition.operator) {
    case "eq":
      return jsonValueEquals(actual, condition.value);
    case "neq":
      return !jsonValueEquals(actual, condition.value);
    case "gt":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual > condition.value
      );
    case "gte":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual >= condition.value
      );
    case "le":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual < condition.value
      );
    case "lte":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual <= condition.value
      );
  }
};

const moveSelection = (
  state: ProcedureExecutionState,
  nextIndex: number,
): ProcedureExecutionState => {
  if (state.steps.length === 0) {
    return state;
  }

  const currentIndex = state.currentStepIndex;
  const clampedNextIndex = clampStepIndex(state.steps, nextIndex);

  if (currentIndex === clampedNextIndex) {
    return state;
  }

  let steps = updateStepAt(state.steps, currentIndex, (step) => setStepSelected(step, false));
  steps = updateStepAt(steps, clampedNextIndex, (step) => setStepSelected(step, true));

  return ProcedureExecutionState.make({
    ...state,
    currentStepIndex: clampedNextIndex,
    steps,
  });
};

const completeCurrentStep = (
  state: ProcedureExecutionState,
  index: number,
): ProcedureExecutionState => {
  const nextIndex = Math.min(index + 1, state.steps.length - 1);
  const steps = updateStepAt(state.steps, index, (step) =>
    setStepLiveData(
      setStepLiveMessage(setStepState(step, "completed"), "Step completed"),
      step.liveData,
    ),
  );

  return ProcedureExecutionState.make({
    ...state,
    currentStepIndex: nextIndex,
    steps:
      nextIndex === index
        ? steps
        : updateStepAt(
            updateStepAt(steps, index, (step) => setStepSelected(step, false)),
            nextIndex,
            (step) => setStepSelected(step, true),
          ),
  });
};

const failCurrentStep = (
  state: ProcedureExecutionState,
  index: number,
  message: string,
): ProcedureExecutionState =>
  ProcedureExecutionState.make({
    ...state,
    steps: updateStepAt(state.steps, index, (step) =>
      setStepLiveData(setStepLiveMessage(setStepState(step, "failed"), message), step.liveData),
    ),
  });

const applyRecordedStepChange = (
  state: ProcedureExecutionState,
  index: number,
  f: (step: ExecutionStep) => ExecutionStep,
): readonly [ProcedureExecutionState, ExecutionStep | undefined] => {
  let updatedStep: ExecutionStep | undefined;
  const steps = updateStepAt(state.steps, index, (step) => {
    updatedStep = f(step);
    return updatedStep;
  });

  if (!updatedStep) {
    return [state, undefined] as const;
  }

  return [
    ProcedureExecutionState.make({
      ...state,
      steps,
    }),
    updatedStep,
  ] as const;
};

export class ProcedureExecutor extends Context.Service<
  ProcedureExecutor,
  {
    readonly state: SubscriptionRef.SubscriptionRef<ProcedureExecutionState>;
    readonly execute: () => Effect.Effect<
      void,
      never,
      YamcsAtomHttpClient | YamcsWebSocketClient | AtomRegistryType.AtomRegistry
    >;
    readonly renderAuditText: () => Effect.Effect<string>;
    readonly selectStep: (index: number) => Effect.Effect<void>;
    readonly selectNextStep: () => Effect.Effect<void>;
    readonly selectPreviousStep: () => Effect.Effect<void>;
  }
>()("@mrt/frontend/ProcedureExecutor") {
  static readonly layer = () =>
    Layer.effect(
      ProcedureExecutor,
      Effect.gen(function* () {
        const parameterService = yield* Parameters;
        const registry = yield* AtomRegistry.AtomRegistry;
        const state = yield* SubscriptionRef.make(
          ProcedureExecutionState.make({
            currentStepIndex: 0,
            steps: TW1.steps.map(ExecutionStep.fromProcedureStep),
          }),
        );
        const log = yield* ProcedureExecutorLog;
        const selectedCommandStep = yield* SubscriptionRef.make<Option.Option<SelectedCommandStep>>(
          Option.none(),
        );

        const syncSelectedCommandStep = (selectedAt: DateTime.Utc) =>
          Effect.gen(function* () {
            const executionState = yield* SubscriptionRef.get(state);
            const step = executionState.steps[executionState.currentStepIndex];

            if (!isCommandExecutionStep(step) || !step.isSelected) {
              yield* SubscriptionRef.set(selectedCommandStep, Option.none());
              return;
            }

            yield* SubscriptionRef.set(
              selectedCommandStep,
              Option.some({
                stepIndex: executionState.currentStepIndex,
                commandName: step.meta.name,
                selectedAt,
                trackedCommandId: null,
              }),
            );
          });

        const setTrackedCommandId = (stepIndex: number, commandId: string) =>
          SubscriptionRef.update(selectedCommandStep, (current) =>
            Option.match(current, {
              onNone: () => Option.none(),
              onSome: (selected) =>
                selected.stepIndex === stepIndex
                  ? Option.some({
                      ...selected,
                      trackedCommandId: commandId,
                    })
                  : current,
            }),
          );

        const recordStepChange = (
          index: number,
          event: ProcedureAuditEventType,
          message: string,
          f: (step: ExecutionStep) => ExecutionStep,
        ) =>
          Effect.gen(function* () {
            const at = yield* DateTime.now;
            const updatedStep = yield* SubscriptionRef.modify(state, (executionState) => {
              const [nextState, updatedStep] = applyRecordedStepChange(executionState, index, f);
              return [updatedStep, nextState] as const;
            });

            if (!updatedStep) {
              return;
            }

            yield* log.append(makeAuditEntry(at, index, updatedStep, event, message));
          });

        const recordSelection = (nextIndex: number) =>
          Effect.gen(function* () {
            const at = yield* DateTime.now;
            const result = yield* SubscriptionRef.modify(state, (executionState) => {
              const nextState = moveSelection(executionState, nextIndex);

              if (nextState.currentStepIndex === executionState.currentStepIndex) {
                return [undefined, executionState] as const;
              }

              const selectedStep = nextState.steps[nextState.currentStepIndex];

              if (!selectedStep) {
                return [undefined, nextState] as const;
              }

              return [
                { index: nextState.currentStepIndex, step: selectedStep },
                nextState,
              ] as const;
            });

            if (!result) {
              return;
            }

            yield* log.append(
              makeAuditEntry(
                at,
                result.index,
                result.step,
                "stepSelected",
                `Selected step ${formatStepDisplayNumber(result.step)}`,
              ),
            );

            yield* syncSelectedCommandStep(at);
          });

        const recordStepOutcome = (
          index: number,
          event: Extract<ProcedureAuditEventType, "stepCompleted" | "stepFailed">,
          message: string,
          f: (state: ProcedureExecutionState) => ProcedureExecutionState,
        ) =>
          Effect.gen(function* () {
            const at = yield* DateTime.now;
            const step = yield* SubscriptionRef.modify(state, (executionState) => {
              const nextState = f(executionState);
              return [nextState.steps[index], nextState] as const;
            });

            if (!step) {
              return;
            }

            yield* log.append(makeAuditEntry(at, index, step, event, message));
            yield* syncSelectedCommandStep(at);
          });

        const awaitCommandResult = (commandId: string, index: number) =>
          timeoutCommandCompletion(
            AtomRegistry.toStreamResult(registry, commandsSubscriptionAtom).pipe(
              Stream.map((commands) => commands.find((entry) => entry.id === commandId)),
              Stream.filter((entry): entry is CommandHistoryEntry => entry !== undefined),
              Stream.changes,
              Stream.tap((entry) =>
                recordStepChange(
                  index,
                  "stepLiveDataUpdated",
                  formatCommandLiveMessage(entry),
                  (step) => setStepLiveData(step, new CommandStepLiveData({ command: entry })),
                ),
              ),
              Stream.filter(isTerminalCommandEntry),
              Stream.runHead,
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new ProcedureStepTimeoutError({
                        message: "Timed out waiting for command completion after 15 seconds",
                      }),
                    ),
                  onSome: Effect.succeed,
                }),
              ),
            ),
          );

        const validateCommandResult = (result: CommandHistoryEntry) => {
          const completionStatus = getCommandAttributeValue(result, "CommandComplete_Status");
          const completionMessage = getCommandAttributeValue(result, "CommandComplete_Message");

          if (completionStatus?.type === "STRING" && completionStatus.value === "NOK") {
            return Effect.fail(
              new ProcedureCommandFailedError({
                message:
                  completionMessage?.type === "STRING"
                    ? completionMessage.value
                    : `Command completion status was ${completionStatus.value}`,
              }),
            );
          }

          return Effect.succeed(result);
        };

        const updateVerifyConditionAt = (
          index: number,
          conditionIndex: number,
          target: "primary" | "mirrored",
          actual: string | null,
          status: VerifyConditionStatus,
        ) =>
          recordStepChange(
            index,
            "stepLiveDataUpdated",
            actual === null ? "Awaiting verification values" : actual,
            (step) => {
              if (!(step.liveData instanceof VerifyStepLiveData)) {
                return step;
              }

              return setStepLiveData(
                step,
                new VerifyStepLiveData({
                  conditions: step.liveData.conditions.map((condition, currentIndex) =>
                    currentIndex === conditionIndex
                      ? VerifyConditionLiveData.make({
                          ...condition,
                          actual: target === "primary" ? actual : condition.actual,
                          status: target === "primary" ? status : condition.status,
                          mirroredActual:
                            target === "mirrored" ? actual : (condition.mirroredActual ?? null),
                          mirroredStatus: target === "mirrored" ? status : condition.mirroredStatus,
                        })
                      : condition,
                  ),
                }),
              );
            },
          );

        const awaitVerifyParameter = (
          index: number,
          conditionIndex: number,
          target: "primary" | "mirrored",
          parameter: QualifiedName,
          condition: VerifyCondition,
          label: string,
        ) =>
          Effect.scoped(
            Effect.gen(function* () {
              const subscription = yield* parameterService.subscribe(parameter);

              return yield* subscription.updates.pipe(
                Stream.tap(({ value }) => {
                  const actual = stringifyValue(value.engValue);
                  const isSatisfied = compareVerifyCondition(
                    valueToComparable(value.engValue),
                    condition,
                  );

                  return updateVerifyConditionAt(
                    index,
                    conditionIndex,
                    target,
                    actual,
                    isSatisfied ? "passed" : "pending",
                  );
                }),
                Stream.filter(({ value }) =>
                  compareVerifyCondition(valueToComparable(value.engValue), condition),
                ),
                Stream.runHead,
                Effect.flatMap(
                  Option.match({
                    onNone: () =>
                      Effect.fail(
                        new ProcedureStepTimeoutError({
                          message: `Verification stream ended before ${label} was satisfied`,
                        }),
                      ),
                    onSome: Effect.succeed,
                  }),
                ),
              );
            }),
          );

        const runStep = (index: number, step: typeof ProcedureStep.Type) => {
          switch (step.type) {
            case "text":
            case "note":
            case "check":
              return recordStepChange(
                index,
                "stepLiveMessageUpdated",
                "No live events for this step",
                (step) => setStepLiveMessage(step, "No live events for this step"),
              );
            case "verify": {
              const initialLiveData = new VerifyStepLiveData({
                conditions: step.condition.map((condition) =>
                  makeVerifyConditionLiveData(step, condition),
                ),
              });

              return Effect.gen(function* () {
                yield* recordStepChange(
                  index,
                  "stepLiveDataUpdated",
                  `Monitoring ${step.condition.length} verification condition${step.condition.length === 1 ? "" : "s"}`,
                  (currentStep) =>
                    setStepLiveData(
                      setStepLiveMessage(currentStep, "Waiting for verification conditions..."),
                      initialLiveData,
                    ),
                );

                if (step.delay > 0) {
                  yield* Effect.sleep(`${step.delay} seconds`);
                }

                yield* timeoutStepCompletion(
                  Effect.all(
                    step.condition.map((condition, conditionIndex) => {
                      const label = formatVerifyConditionLabel(step, condition);
                      const mirroredParameter = getMirroredParameterName(condition.parameter);

                      return Effect.all(
                        [
                          awaitVerifyParameter(
                            index,
                            conditionIndex,
                            "primary",
                            condition.parameter,
                            condition,
                            label,
                          ),
                          ...(mirroredParameter
                            ? [
                                awaitVerifyParameter(
                                  index,
                                  conditionIndex,
                                  "mirrored",
                                  mirroredParameter,
                                  condition,
                                  `${label} (System B)`,
                                ),
                              ]
                            : []),
                        ],
                        { concurrency: "unbounded" },
                      );
                    }),
                    { concurrency: "unbounded" },
                  ),
                  step.timeout ? `${step.timeout} seconds` : undefined,
                );
              });
            }
            case "command":
              return Effect.gen(function* () {
                const yamcsConfig = yield* YamcsConfig;

                const cmd = yield* YamcsAtomHttpClient.use((client) =>
                  client.command.issueCommand({
                    params: {
                      name: step.name,
                      instance: yamcsConfig.instance,
                      processor: yamcsConfig.processor,
                    },
                    payload: {},
                  }),
                );

                yield* setTrackedCommandId(index, cmd.id);

                yield* recordStepChange(index, "stepLiveMessageUpdated", `Sent ${cmd.id}`, (step) =>
                  setStepLiveMessage(step, `Sent ${cmd.id}`),
                );

                const result = yield* awaitCommandResult(cmd.id, index);

                return yield* validateCommandResult(result);
              });
          }
        };

        yield* AtomRegistry.toStreamResult(registry, commandsSubscriptionAtom).pipe(
          Stream.runForEach((commands) =>
            Effect.gen(function* () {
              const selected = yield* SubscriptionRef.get(selectedCommandStep);

              if (Option.isNone(selected)) {
                return;
              }

              const executionState = yield* SubscriptionRef.get(state);
              const currentStep = executionState.steps[selected.value.stepIndex];

              if (
                executionState.currentStepIndex !== selected.value.stepIndex ||
                !isCommandExecutionStep(currentStep) ||
                !currentStep.isSelected
              ) {
                return;
              }

              const candidate = commands.find(
                (command) =>
                  command.commandName === selected.value.commandName &&
                  command.id !== selected.value.trackedCommandId &&
                  DateTime.toEpochMillis(command.generationTime) >=
                    DateTime.toEpochMillis(selected.value.selectedAt),
              );

              if (!candidate) {
                return;
              }

              yield* setTrackedCommandId(selected.value.stepIndex, candidate.id);

              yield* recordStepChange(
                selected.value.stepIndex,
                "stepExecutionStarted",
                "Starting step...",
                (step) => setStepLiveMessage(setStepState(step, "running"), "Starting step..."),
              );

              yield* recordStepChange(
                selected.value.stepIndex,
                "stepLiveMessageUpdated",
                `Sent ${candidate.id}`,
                (step) => setStepLiveMessage(step, `Sent ${candidate.id}`),
              );

              const exit = yield* Effect.exit(
                awaitCommandResult(candidate.id, selected.value.stepIndex).pipe(
                  Effect.flatMap(validateCommandResult),
                ),
              );

              if (Exit.isSuccess(exit)) {
                yield* recordStepOutcome(
                  selected.value.stepIndex,
                  "stepCompleted",
                  "Step completed",
                  (executionState) => completeCurrentStep(executionState, selected.value.stepIndex),
                );
                return;
              }

              const failureMessage = Cause.prettyErrors(exit.cause).join(", ");

              yield* recordStepOutcome(
                selected.value.stepIndex,
                "stepFailed",
                failureMessage,
                (executionState) =>
                  failCurrentStep(executionState, selected.value.stepIndex, failureMessage),
              );
            }),
          ),
          Effect.forkScoped,
        );

        const execute = Effect.fn("ProcedureExecutor.execute")(function* () {
          const executionState = yield* SubscriptionRef.get(state);
          const step = executionState.steps[executionState.currentStepIndex];

          const current = step ? { index: executionState.currentStepIndex, step } : undefined;

          if (!current) {
            return;
          }

          yield* recordStepChange(
            current.index,
            "stepExecutionStarted",
            "Starting step...",
            (step) => setStepLiveMessage(setStepState(step, "running"), "Starting step..."),
          );

          const exit = yield* Effect.exit(runStep(current.index, current.step.meta));

          if (Exit.isSuccess(exit)) {
            yield* recordStepOutcome(
              current.index,
              "stepCompleted",
              "Step completed",
              (executionState) => completeCurrentStep(executionState, current.index),
            );
            return;
          }

          const failureMessage = Cause.prettyErrors(exit.cause).join(", ");

          yield* recordStepOutcome(current.index, "stepFailed", failureMessage, (executionState) =>
            failCurrentStep(executionState, current.index, failureMessage),
          );
        });

        const renderAuditText = () => log.renderText;

        const selectStep = (index: number) => recordSelection(index);

        const selectNextStep = () =>
          Effect.flatMap(SubscriptionRef.get(state), (executionState) =>
            recordSelection(executionState.currentStepIndex + 1),
          );

        const selectPreviousStep = () =>
          Effect.flatMap(SubscriptionRef.get(state), (executionState) =>
            recordSelection(executionState.currentStepIndex - 1),
          );

        return ProcedureExecutor.of({
          state,
          execute,
          renderAuditText,
          selectStep,
          selectNextStep,
          selectPreviousStep,
        });
      }),
    );
}
