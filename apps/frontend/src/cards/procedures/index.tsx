import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { ProcedureStack, ProcedureStep } from "@mrt/yamcs-procedures";
import { Schema } from "effect";
import { Suspense } from "react";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

import { TW1 } from "./procedures/tw1";

export const ProceduresCard = makeCard({
  id: "procedures-card",
  name: "Procedures Card",
  schema: Schema.Struct({}),
  component: () => <ProcedureView procedure={TW1} />,
});

function ProcedureView({ procedure }: { procedure: typeof ProcedureStack.Type }) {
  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="sticky top-0 h-8 bg-background border-b">
        <button className="size-8 border-r">N</button>
      </div>
      <div className="grid pb-6 grid-cols-[auto_auto_1fr] gap-x-2 gap-y-4 font-mono text-sm text-orange-text max-w-[80ch] mx-auto">
        {procedure.steps.map((step) => (
          <Suspense fallback="Loading...">
            <ProcedureStepView step={step} />
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

function ProcedureStepView({ step }: { step: typeof ProcedureStep.Type }) {
  if (step.type === "note") {
    return (
      <div className="col-span-full text-center text-black" style={{ background: step.color }}>
        {step.text}
      </div>
    );
  }

  const instance = useAtomValue(selectedInstanceAtom);
  const sendCommand = useAtomSet(YamcsAtomHttpClient.mutation("command", "issueCommand"));

  return (
    <div className="grid grid-cols-subgrid col-span-full px-2">
      <div>
        {step.stepNumber}
        {step.stepNumber && "."}
      </div>
      <div className="pr-2">{step.role}</div>
      {(() => {
        switch (step.type) {
          case "text":
            return <div className="whitespace-pre-wrap text-pretty">{step.text}</div>;
          case "check":
            return <div className="whitespace-pre-line text-pretty">{step.comment}</div>;
          case "verify":
            return (
              <div className="whitespace-pre-line text-pretty">
                {step.comment}
                {step.presentation?.type === "truthTable" && <TruthTable step={step} />}
              </div>
            );
          case "command":
            return (
              <div className="space-y-2">
                <div className="whitespace-pre-line text-pretty">{step.comment}</div>
                <button
                  className="p-1 border border-current hover:bg-current/25"
                  onClick={() =>
                    sendCommand({
                      params: { instance, processor: "realtime", name: step.name },
                      payload: {},
                    })
                  }
                >
                  SEND
                </button>
              </div>
            );
        }
      })()}
    </div>
  );
}
