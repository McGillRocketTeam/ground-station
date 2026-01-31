import { makeCard } from "@/lib/cards";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { Schema } from "effect";
import { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import "./parameter-table.css";

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
      <div className="grid grid-cols-[2rem_3fr_1fr_auto] gap-px font-mono">
        <TableHeader />
        {parameters.map((parameter) => (
          <TableRow key={parameter} parameter={parameter} />
        ))}
      </div>
    );
  },
});

function TableHeader() {
  return (
    <div className="text-white-text grid col-span-full grid-cols-subgrid uppercase text-sm">
      <div className="bg-background-secondary border-t border-t-background-secondary-highlight px-1"></div>
      <div className="bg-background-secondary border-t border-t-background-secondary-highlight px-1">
        Parameter
      </div>
      <div className="bg-background-secondary border-t border-t-background-secondary-highlight px-1">
        Value
      </div>
      <div className="bg-background-secondary border-t border-t-background-secondary-highlight px-1">
        Unit
      </div>
    </div>
  );
}

function TableRow({ parameter }: { parameter: string }) {
  return (
    <div className="grid col-span-full grid-cols-subgrid *:bg-background hover:*:bg-selection-background *:px-1">
      <div />
      <div className="text-ellipsis line-clamp-1 uppercase">{parameter}</div>
      <Value name={parameter} />
    </div>
  );
}

function Value({ name }: { name: string }) {
  const test = useAtomValue(parameterSubscriptionAtom(name));

  return Result.match(test, {
    onInitial: () => (
      <>
        <div>--</div>
        <div></div>
      </>
    ),
    onFailure: () => <div>Failure</div>,
    onSuccess: ({ value }) => (
      <>
        <div>
          {"value" in value.engValue
            ? value.engValue.value.toLocaleString()
            : "Unknown Value Type"}
        </div>
        <div>{value.numericId}</div>
      </>
    ),
  });
}
