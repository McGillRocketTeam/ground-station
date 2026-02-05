import { makeCard } from "@/lib/cards";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { Cause, Schema } from "effect";
import { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import { useState, type ReactNode } from "react";

const CardEntries = {
  "FLIGHT COMPUTER": [
    "/FlightComputer/acceleration_x",
    "/FlightComputer/acceleration_y",
    "/FlightComputer/call_sign",
  ],
  "LAUNCH PAD": [
    "/FlightComputer/acceleration_x",
    "/FlightComputer/acceleration_y",
    "/FlightComputer/call_sign",
  ],
};

export const ParameterTable = makeCard({
  id: "parameter-table",
  name: "Parameter Table",
  schema: Schema.Struct({}),
  component: () => {
    return (
      <div className="grid grid-cols-[1.5rem_3fr_1fr_auto] gap-px font-mono">
        <TableHeader />
        {Object.entries(CardEntries).map(([title, parameters]) => (
          <TableGroup key={title} name={title}>
            {parameters.map((parameter) => (
              <TableRow key={parameter} parameter={parameter} />
            ))}
          </TableGroup>
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

function TableGroup({ children, name }: { children: ReactNode; name: string }) {
  const [collapse, setCollapse] = useState(false);
  return (
    <>
      <button
        onClick={() => setCollapse((prev) => !prev)}
        className="text-left col-span-full text-white-text bg-background-secondary hover:bg-background-secondary-highlight border-t border-t-background-secondary-highlight"
      >
        <span
          data-collapsed={collapse}
          className="inline-block text-center data-[collapsed=true]:-rotate-90 w-6 mr-1"
        >
          ▼
        </span>
        {name}
      </button>
      {!collapse && (
        <div className="grid col-span-full grid-cols-subgrid text-orange-text bg-border gap-px">
          {children}
        </div>
      )}
    </>
  );
}

function TableRow({ parameter }: { parameter: string }) {
  return (
    <div className="grid col-span-full grid-cols-subgrid text-sm *:bg-background hover:*:bg-selection-background *:px-1">
      <div />
      <div className="text-ellipsis line-clamp-1">{parameter}</div>
      <Value name={parameter} />
    </div>
  );
}

function Value({ name }: { name: string }) {
  const test = useAtomValue(parameterSubscriptionAtom(name));

  return Result.match(test, {
    onInitial: () => (
      <>
        <div className="text-right text-muted-foreground">Awaiting Value</div>
      </>
    ),
    onFailure: ({ cause }) => (
      <pre className="col-span-full text-error text-center min-h-full uppercase">
        {Cause.pretty(cause)}
      </pre>
    ),
    onSuccess: ({ value }) => (
      <>
        <div className="text-right">
          {"value" in value.engValue
            ? value.engValue.value.toLocaleString()
            : "Unknown Value Type"}
        </div>
        <div>{value.numericId}</div>
      </>
    ),
  });
}
