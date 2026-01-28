import { makeCard } from "@/lib/cards";
import { useAtomSuspense } from "@effect-atom/atom-react";
import { Schema } from "effect";
import { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import { Suspense } from "react";
import { displayValue } from "@/lib/utils";

const parameters = [
  "/FlightComputer/acceleration_x",
  "/FlightComputer/acceleration_y",
  "/FlightComputer/call_sign",
];

export const ParameterTable = makeCard({
  id: "parameter-table",
  name: "Parameter Table",
  schema: Schema.Struct({}),
  component: () => {
    return (
      <div>
        Parameter Table
        <div className="grid">
          {parameters.map((parameter) => (
            <Suspense key={parameter} fallback={<div>loading...</div>}>
              <ParameterValue parameter={parameter} />
            </Suspense>
          ))}
        </div>
      </div>
    );
  },
});

function ParameterValue({ parameter }: { parameter: string }) {
  const subscription = useAtomSuspense(
    parameterSubscriptionAtom(parameter),
  ).value;

  const value = displayValue(subscription.engValue);

  return (
    <div>
      {value.kind === "number"
        ? value.value.toFixed(2)
        : value.kind === "string"
          ? value.value
          : "Unknown"}
    </div>
  );
}
