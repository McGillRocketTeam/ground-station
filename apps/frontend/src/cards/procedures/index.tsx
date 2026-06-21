import { useAtomSet, useAtomSuspense } from "@effect/atom-react";
import { ProcedureStack, ProcedureStep } from "@mrt/yamcs-procedures";
import { Schema } from "effect";
import { Fragment, Suspense } from "react";

import { BrailleSpinner } from "@/cards/command-history/braile-spinner";
import { AckRow, FCAckRow } from "@/cards/command-history/command-detail";
import { collectAcks } from "@/cards/command-history/utils";
import { makeCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

import { CommandStepLiveData, VerifyStepLiveData } from "./procedure-executor";
import {
  downloadProcedureAuditTextAtom,
  executeProcedureStepAtom,
  procedureExecutionStepAtom,
  selectNextProcedureStepAtom,
  selectProcedureStepAtom,
  selectPreviousProcedureStepAtom,
} from "./procedure-executor.atoms";
import { TW1 } from "./procedures/tw1";

export const ProceduresCard = makeCard({
  id: "procedures-card",
  name: "Procedures Card",
  schema: Schema.Struct({}),
  component: () => <ProcedureView procedure={TW1} />,
});

function ProcedureView({ procedure }: { procedure: typeof ProcedureStack.Type }) {
  const selectNextStep = useAtomSet(selectNextProcedureStepAtom);
  const selectPreviousStep = useAtomSet(selectPreviousProcedureStepAtom);
  const executeStep = useAtomSet(executeProcedureStepAtom);
  const downloadAuditText = useAtomSet(downloadProcedureAuditTextAtom);

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="sticky top-0 z-10 flex h-8 bg-background border-b text-sm">
        <button type="button" onClick={() => selectPreviousStep()} className="h-full border-r px-2">
          Prev
        </button>
        <button type="button" onClick={() => selectNextStep()} className="h-full border-r px-2">
          Next
        </button>
        <button type="button" onClick={() => executeStep()} className="h-full border-r px-2">
          Execute
        </button>
        <button type="button" onClick={() => downloadAuditText()} className="h-full border-r px-2">
          Download Log
        </button>
      </div>
      <div className="grid pb-6 grid-cols-[auto_auto_1fr] gap-x-2 font-mono text-sm text-orange-text max-w-[80ch] mx-auto">
        {procedure.steps.map((step, index) => (
          <Suspense
            fallback={<div className="col-span-full">Loading...</div>}
            key={procedureStepKey(step)}
          >
            <ProcedureStepView index={index} />
          </Suspense>
        ))}
      </div>
    </div>
  );
}

function TruthTable({ step }: { step: Extract<typeof ProcedureStep.Type, { type: "verify" }> }) {
  if (!step.presentation) {
    return null;
  }

  const presentation = step.presentation;
  const rowNames = [
    ...new Set(
      step.condition.flatMap((condition) =>
        condition.display?.row ? [condition.display.row] : [],
      ),
    ),
  ];

  return (
    <table className="mt-4 mb-2 border-collapse border border-current">
      <thead className="border-b border-current">
        <tr>
          <th className="border-r border-current px-2 py-1 text-left font-normal">Device</th>
          {presentation.columns.map((column) => (
            <th
              className="border-r border-current px-2 py-1  text-left font-normal last:border-r-0"
              key={column.id}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowNames.map((rowName, index) => {
          const verticalPadding = [
            "py-0.5",
            index === 0 ? "pt-1" : "",
            index === rowNames.length - 1 ? "pb-1" : "",
          ].join(" ");

          return (
            <tr key={rowName}>
              <th
                className={`border-r border-current px-2 text-left font-normal ${verticalPadding}`}
              >
                {rowName}
              </th>
              {presentation.columns.map((column) => {
                const condition = step.condition.find(
                  (item) => item.display?.row === rowName && item.display?.column === column.id,
                );

                return (
                  <td
                    className={`border-r border-current px-2 last:border-r-0 ${verticalPadding}`}
                    key={column.id}
                  >
                    {condition ? formatValue(condition.value) : ""}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return String(value);
}

function VerifyConditionList({ liveData }: { liveData: VerifyStepLiveData }) {
  return (
    <div className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <div>SYS A</div>
      <div>SYS B</div>
      <div>Condition</div>
      {liveData.conditions.map((condition) => (
        <Fragment key={`${condition.parameter}-${condition.label}`}>
          <div
            className={cn(
              "w-3ch",
              condition.status === "passed" ? "text-success" : "text-muted-foreground",
            )}
          >
            {condition.status === "passed" ? "OK" : <BrailleSpinner />}
          </div>
          <div
            className={cn(
              "w-3ch",
              condition.mirroredStatus === undefined && "text-transparent",
              condition.mirroredStatus === "passed" && "text-success",
              condition.mirroredStatus === "pending" && "text-muted-foreground",
            )}
          >
            {condition.mirroredStatus === undefined ? (
              "OK"
            ) : condition.mirroredStatus === "passed" ? (
              "OK"
            ) : (
              <BrailleSpinner />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground">{condition.label}</span>
            <span>
              {condition.operator} {condition.expected}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function procedureStepKey(step: typeof ProcedureStep.Type) {
  if (step.stepNumber !== undefined) {
    return `${step.type}-${step.stepNumber}`;
  }

  switch (step.type) {
    case "note":
    case "text":
      return `${step.type}-${step.text}`;
    case "check":
    case "verify":
      return `${step.type}-${step.comment}`;
    case "command":
      return `${step.type}-${step.name}`;
  }
}

function ProcedureStepView({ index }: { index: number }) {
  const executionStep = useAtomSuspense(procedureExecutionStepAtom(index)).value;
  const step = executionStep.meta;
  const selectStep = useAtomSet(selectProcedureStepAtom);

  if (step.type === "note") {
    return (
      <div className="col-span-full text-center text-black" style={{ background: step.color }}>
        {step.text}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-subgrid col-span-full px-2 py-2",
        executionStep.isSelected ? "bg-selection-background/30" : "",
      )}
      onClick={() => selectStep(index)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectStep(index);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div>
        {step.stepNumber}
        {step.stepNumber && "."}
      </div>
      <div className="pr-2">{step.role}</div>
      <div className="space-y-2">
        {(() => {
          switch (step.type) {
            case "text":
              return <div className="whitespace-pre-wrap text-pretty">{step.text}</div>;
            case "check":
              return <div className="whitespace-pre-line text-pretty">{step.comment}</div>;
            case "verify":
              return (
                <>
                  <div className="whitespace-pre-line text-pretty">
                    {step.comment}
                    {step.presentation?.type === "truthTable" && <TruthTable step={step} />}
                  </div>
                  {executionStep.liveData instanceof VerifyStepLiveData ? (
                    <VerifyConditionList liveData={executionStep.liveData} />
                  ) : null}
                </>
              );
            case "command":
              if (!(executionStep.liveData instanceof CommandStepLiveData)) {
                return <div className="whitespace-pre-line text-pretty">{step.comment}</div>;
              }

              const command = executionStep.liveData.command;
              const acks = collectAcks(command);

              return (
                <>
                  <div className="whitespace-pre-line text-pretty">{step.comment}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
                      <div className="col-span-full text-foreground pb-1">Ground Station</div>
                      {acks.yamcs.map((ack) => (
                        <AckRow key={ack.name} ack={ack} command={command} />
                      ))}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
                      <div className="col-span-full text-foreground pb-1">SYSTEM A</div>
                      {acks.systemA.map((ack) => (
                        <AckRow
                          friendlyName={ack.label}
                          key={ack.name}
                          ack={ack}
                          command={command}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
                      <div className="col-span-full text-foreground pb-1">SYSTEM B</div>
                      {acks.systemB.map((ack) => (
                        <AckRow
                          friendlyName={ack.label}
                          key={ack.name}
                          ack={ack}
                          command={command}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
                      {acks.other.map((ack) => (
                        <AckRow
                          friendlyName={ack.label}
                          key={ack.name}
                          ack={ack}
                          command={command}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
                    {acks.completion ? <FCAckRow ack={acks.completion} command={command} /> : null}
                  </div>
                </>
              );
          }
        })()}
        {executionStep.liveMessage ? (
          <div
            className={cn(
              "text-xs uppercase tracking-wide text-muted-foreground",
              executionStep.state === "failed" && "text-error normal-case",
            )}
          >
            {executionStep.liveMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
