import type { AtomRegistry } from "effect/unstable/reactivity";

import {
  CommandHistoryEvent,
  mergeCommandEntries,
  ProcedureStep,
  StreamingCommandHisotryEntry,
  SubscribeCommandsRequest,
  WebSocketClient,
} from "@mrt/yamcs-effect";
import {
  Cause,
  Context,
  Data,
  Effect,
  Exit,
  Layer,
  Option,
  Queue,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import { get } from "effect/unstable/reactivity/Atom";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import { TW1 } from "./procedures/tw1";

class AduitCommand extends Schema.TaggedClass<AduitCommand>()("AduitCommand", {
  //...
}) {}

class AuditText extends Schema.TaggedClass<AuditText>()("AuditText", {
  //...
}) {}

const AuditEntry = Schema.Union([AduitCommand, AuditText]);
type AuditEntry = typeof AuditEntry.Type;

export class ProcedureExecutorLog extends Context.Service<ProcedureExecutorLog, {}>()(
  "@mrt/frontend/ProcedureExecutorLog",
) {
  static readonly layer = Layer.effect(
    ProcedureExecutorLog,
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<string>();

      const output = Stream.fromQueue(queue).pipe(
        Stream.runFold(
          () => "",
          (a, b) => {
            return a + "\n" + b;
          },
        ),
      );

      return { output };
    }),
  );
}

const ExecutionStepState = Schema.Literals(["initial", "running", "completed", "failed"]);
type ExecutionStepState = typeof ExecutionStepState.Type;

class EmptyStepLiveData extends Schema.TaggedClass<EmptyStepLiveData>()("EmptyStepLiveData", {}) {}

export class CommandStepLiveData extends Schema.TaggedClass<CommandStepLiveData>()(
  "CommandStepLiveData",
  {
    command: StreamingCommandHisotryEntry,
  },
) {}

const StepLiveData = Schema.Union([EmptyStepLiveData, CommandStepLiveData]);
type StepLiveData = typeof StepLiveData.Type;

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

export class ProcedureExecutionState extends Schema.Class<ProcedureExecutionState>(
  "ProcedureExecutionState",
)({
  currentStepIndex: Schema.Number,
  steps: Schema.Array(ExecutionStep),
  audit: Schema.Array(AuditEntry),
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

const formatCommandLiveMessage = (entry: (typeof CommandHistoryEvent.Type)["data"]) =>
  entry.attr.map((attr) => `${attr.name}: ${formatAttrValue(attr)}`).join("\n");

const getCommandAttributeValue = (entry: (typeof CommandHistoryEvent.Type)["data"], name: string) =>
  entry.attr.find((attr) => attr.name === name)?.value;

const isTerminalCommandEntry = (entry: (typeof CommandHistoryEvent.Type)["data"]) =>
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

const timeoutCommandCompletion = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.timeoutOrElse({
      duration: "15 seconds",
      orElse: () =>
        Effect.fail(
          new ProcedureStepTimeoutError({
            message: "Timed out waiting for command completion after 15 seconds",
          }),
        ),
    }),
  );

const clampStepIndex = (steps: ReadonlyArray<ExecutionStep>, index: number): number => {
  if (steps.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, steps.length - 1));
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

export class ProcedureExecutor extends Context.Service<
  ProcedureExecutor,
  {
    readonly state: SubscriptionRef.SubscriptionRef<ProcedureExecutionState>;
    readonly execute: () => Effect.Effect<
      void,
      never,
      YamcsAtomHttpClient | WebSocketClient | AtomRegistry.AtomRegistry
    >;
    readonly selectStep: (index: number) => Effect.Effect<void>;
    readonly selectNextStep: () => Effect.Effect<void>;
    readonly selectPreviousStep: () => Effect.Effect<void>;
  }
>()("@mrt/frontend/ProcedureExecutor") {
  static readonly layer = () =>
    Layer.effect(
      ProcedureExecutor,
      Effect.gen(function* () {
        const state = yield* SubscriptionRef.make(
          ProcedureExecutionState.make({
            currentStepIndex: 0,
            steps: TW1.steps.map(ExecutionStep.fromProcedureStep),
            audit: [],
          }),
        );

        const updateExecutionStep = (index: number, f: (step: ExecutionStep) => ExecutionStep) =>
          SubscriptionRef.update(state, (executionState) =>
            ProcedureExecutionState.make({
              ...executionState,
              steps: updateStepAt(executionState.steps, index, f),
            }),
          );

        const runStep = (index: number, step: typeof ProcedureStep.Type) => {
          switch (step.type) {
            case "text":
            case "note":
            case "check":
            case "verify":
              return updateExecutionStep(index, (step) =>
                setStepLiveMessage(step, "No live events for this step"),
              );
            case "command":
              return Effect.gen(function* () {
                const ws = yield* WebSocketClient;

                const instance = yield* get(selectedInstanceAtom);

                const { call, stream } = yield* ws.subscribe(
                  SubscribeCommandsRequest.make({
                    instance,
                    processor: "realtime",
                  }),
                );

                const cmd = yield* YamcsAtomHttpClient.use((client) =>
                  client.command.issueCommand({
                    params: { name: step.name, instance, processor: "realtime" },
                    payload: {},
                  }),
                );

                const result = yield* timeoutCommandCompletion(
                  stream.pipe(
                    Stream.mapEffect((msg) => Schema.decodeEffect(CommandHistoryEvent)(msg)),
                    Stream.map((message) => message.data),
                    Stream.filter((entry) => entry.id === cmd.id),
                    Stream.scan<
                      (typeof CommandHistoryEvent.Type)["data"] | undefined,
                      (typeof CommandHistoryEvent.Type)["data"]
                    >(undefined, (current, next) =>
                      current ? mergeCommandEntries(current, next) : next,
                    ),
                    Stream.filter(
                      (entry): entry is (typeof CommandHistoryEvent.Type)["data"] =>
                        entry !== undefined,
                    ),
                    Stream.tap((entry) => Effect.logInfo(formatCommandLiveMessage(entry))),
                    Stream.tap((entry) =>
                      updateExecutionStep(index, (step) =>
                        setStepLiveData(step, new CommandStepLiveData({ command: entry })),
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
                    Effect.ensuring(ws.unsubscribe(call)),
                  ),
                );

                const completionStatus = getCommandAttributeValue(result, "CommandComplete_Status");
                const completionMessage = getCommandAttributeValue(
                  result,
                  "CommandComplete_Message",
                );

                if (completionStatus?.type === "STRING" && completionStatus.value === "NOK") {
                  return yield* new ProcedureCommandFailedError({
                    message:
                      completionMessage?.type === "STRING"
                        ? completionMessage.value
                        : `Command completion status was ${completionStatus.value}`,
                  });
                }

                return result;
              });
          }
        };

        const execute = Effect.fn("ProcedureExecutor.execute")(function* () {
          const current = yield* SubscriptionRef.modify(state, (executionState) => {
            const step = executionState.steps[executionState.currentStepIndex];

            if (!step) {
              return [undefined, executionState] as const;
            }

            return [
              { index: executionState.currentStepIndex, step },
              ProcedureExecutionState.make({
                ...executionState,
                steps: updateStepAt(executionState.steps, executionState.currentStepIndex, (step) =>
                  setStepLiveMessage(setStepState(step, "running"), "Starting step..."),
                ),
              }),
            ] as const;
          });

          if (!current) {
            return;
          }

          const exit = yield* Effect.exit(runStep(current.index, current.step.meta));

          yield* SubscriptionRef.update(state, (executionState) =>
            Exit.isSuccess(exit)
              ? completeCurrentStep(executionState, current.index)
              : failCurrentStep(
                  executionState,
                  current.index,
                  Cause.prettyErrors(exit.cause).join(", "),
                ),
          );
        });

        const selectStep = (index: number) =>
          SubscriptionRef.update(state, (executionState) => moveSelection(executionState, index));

        const selectNextStep = () =>
          SubscriptionRef.update(state, (executionState) =>
            moveSelection(executionState, executionState.currentStepIndex + 1),
          );

        const selectPreviousStep = () =>
          SubscriptionRef.update(state, (executionState) =>
            moveSelection(executionState, executionState.currentStepIndex - 1),
          );

        return ProcedureExecutor.of({
          state,
          execute,
          selectStep,
          selectNextStep,
          selectPreviousStep,
        });
      }),
    );
}
