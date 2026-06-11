import { WebSocketClient } from "@mrt/yamcs-effect";
import { Effect, Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { YamcsAtomHttpClient } from "@/lib/atom";

import { ProcedureExecutor, ProcedureExecutorLog } from "./procedure-executor";

const procedureRuntime = YamcsAtomHttpClient.runtime.factory((get) =>
  Layer.provideMerge(
    Layer.merge(
      Layer.provideMerge(ProcedureExecutor.layer(), ProcedureExecutorLog.layer),
      WebSocketClient.layer,
    ),
    get(YamcsAtomHttpClient.runtime.layer),
  ),
);

export const procedureExecutionStateAtom = procedureRuntime.subscriptionRef(
  ProcedureExecutor.use((executor) => Effect.succeed(executor.state)),
);

export const currentProcedureStepIndexAtom = procedureRuntime.atom((get) =>
  Effect.map(get.result(procedureExecutionStateAtom), (state) => state.currentStepIndex),
);

export const procedureExecutionStepAtom = Atom.family((index: number) =>
  procedureRuntime.atom((get) =>
    Effect.map(get.result(procedureExecutionStateAtom), (state) => state.steps[index]),
  ),
);

export const executeProcedureStepAtom = procedureRuntime.fn<void>()(() =>
  ProcedureExecutor.use((executor) => executor.execute()),
);

export const downloadProcedureAuditTextAtom = procedureRuntime.fn<void>()(() =>
  Effect.gen(function* () {
    const text = yield* ProcedureExecutor.use((executor) => executor.renderAuditText());

    yield* Effect.sync(() => {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `procedure-audit-${new Date().toISOString().replaceAll(":", "-")}.txt`;
      anchor.click();

      URL.revokeObjectURL(url);
    });
  }),
);

export const selectProcedureStepAtom = procedureRuntime.fn<number>()((index) =>
  ProcedureExecutor.use((executor) => executor.selectStep(index)),
);

export const selectNextProcedureStepAtom = procedureRuntime.fn<void>()(() =>
  ProcedureExecutor.use((executor) => executor.selectNextStep()),
);

export const selectPreviousProcedureStepAtom = procedureRuntime.fn<void>()(() =>
  ProcedureExecutor.use((executor) => executor.selectPreviousStep()),
);
