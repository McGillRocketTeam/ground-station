import { useAtomSuspense } from "@effect/atom-react";
import { useState, type ReactNode } from "react";

import { flightReplayStateAtom } from "../data";

export function DataTablePanel() {
  const data = useAtomSuspense(flightReplayStateAtom).value;
  return (
    <div className="w-full h-full">
      <div className="grid grid-cols-[1.5rem_minmax(12rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)] gap-px font-mono">
        <TableHeader />
        <TableGroup name="Flight">
          {data.currentGpsState && (
            <>
              <TableRow parameter={"Stage"} value={data.currentFlightStage} />
            </>
          )}
        </TableGroup>
        <TableGroup name="GPS">
          {data.currentGpsState && (
            <>
              <TableRow parameter={"Latitude"} value={data.currentGpsState.latitude} />
              <TableRow parameter={"Longitude"} value={data.currentGpsState.longitude} />
              <TableRow parameter={"Altitude"} value={data.currentGpsState.altitude ?? -1} />
            </>
          )}
        </TableGroup>
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div className="sticky top-0 z-10 col-span-full grid grid-cols-subgrid text-sm text-white-text uppercase">
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1" />
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        Parameter
      </div>
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        System A
      </div>
      <div className="border-t border-t-background-secondary-highlight bg-background-secondary px-1">
        System B
      </div>
      {/* <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1"> */}
      {/*   Unit */}
      {/* </div> */}
    </div>
  );
}

function TableGroup({ children, name }: { children: ReactNode; name: string }) {
  const [collapse, setCollapse] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setCollapse((prev) => !prev)}
        className="col-span-full border-t border-t-background-secondary-highlight bg-background-secondary text-left text-sm text-white-text hover:bg-background-secondary-highlight"
      >
        <span
          data-collapsed={collapse}
          className="mr-1 inline-block w-6 text-center transition-transform data-[collapsed=true]:-rotate-90"
        >
          ▼
        </span>
        {name}
      </button>

      {!collapse && (
        <div className="col-span-full grid grid-cols-subgrid gap-px bg-border text-orange-text">
          {children}
        </div>
      )}
    </>
  );
}

function TableRow({ parameter, value }: { parameter: string; value: number | string }) {
  return (
    <div className="col-span-full grid grid-cols-subgrid text-sm *:bg-background *:px-1 hover:*:bg-selection-background data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]">
      <div />
      <div className="line-clamp-1 text-ellipsis text-left" title={parameter}>
        {parameter}
      </div>
      <div></div>
      <div className="text-right">{value}</div>
    </div>
  );
}
