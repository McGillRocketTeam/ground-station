import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";

import { Parameters, WebSocketClient, YamcsConfig } from "@mrt/yamcs-effect";
import { Effect, Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { selectedInstanceAtom, YamcsAtomHttpClient, yamcsBaseUrl } from "@/lib/atom";

import { ProcedureExecutor, ProcedureExecutorLog } from "./procedure-executor";

type ProcedureRuntimeContext = AtomRegistry.AtomRegistry | Reactivity.Reactivity;

const procedureRuntime = YamcsAtomHttpClient.runtime.factory((get) => {
  const yamcsConfigLayer = Layer.succeed(YamcsConfig, {
    url: new URL(yamcsBaseUrl),
    instance: get(selectedInstanceAtom),
    processor: "realtime",
  });
  const runtimeLayer = get(YamcsAtomHttpClient.runtime.layer);
  const sharedLayer = Layer.merge(
    runtimeLayer,
    Layer.merge(WebSocketClient.layer, yamcsConfigLayer),
  );
  const parametersLayer = Layer.provideMerge(Parameters.layer, sharedLayer);

  return Layer.provideMerge(
    Layer.provideMerge(ProcedureExecutor.layer(), ProcedureExecutorLog.layer),
    Layer.merge(sharedLayer, parametersLayer),
  ) as Layer.Layer<any, any, ProcedureRuntimeContext>;
});

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
