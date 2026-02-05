import { makeCard } from "@/lib/cards";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";
import { useState, type ReactNode } from "react";

const CardEntries = {
  "FLIGHT ATOMIC": [
    "/FlightComputer/flight_stage",
    "/FlightComputer/altimeter_altitude",
    "/FlightComputer/altitude_from_sea_level",
    "/FlightComputer/apogee_from_ground",
    "/FlightComputer/atm_pressure",
    "/FlightComputer/barometer_altitude",
    "/FlightComputer/atm_temp",
    "/FlightComputer/gps_latitude",
    "/FlightComputer/gps_longitude",
    "/FlightComputer/gps_altitude",
    "/FlightComputer/gps_time_last_update",
    "/FlightComputer/vertical_speed",
    "/FlightComputer/acceleration_x",
    "/FlightComputer/acceleration_y",
    "/FlightComputer/acceleration_z",
    "/FlightComputer/angle_yaw",
    "/FlightComputer/angle_pitch",
    "/FlightComputer/angle_roll",
    "/FlightComputer/fc_rssi",
    "/FlightComputer/fc_snr",
  ],
  "RADIO ATOMIC": ["/FlightComputer/call_sign"],
  "PROPULSION ATOMIC": [
    "/FlightComputer/	cc_pressure",
    "/FlightComputer/tank_pressure",
    "/FlightComputer/tank_temp",
    "/FlightComputer/vent_temp",
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
    <div className="text-white-text col-span-full grid grid-cols-subgrid text-sm uppercase">
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1"></div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        Parameter
      </div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        Value
      </div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
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
        className="text-white-text bg-background-secondary hover:bg-background-secondary-highlight border-t-background-secondary-highlight col-span-full border-t text-left text-sm"
      >
        <span
          data-collapsed={collapse}
          className="mr-1 inline-block w-6 text-center data-[collapsed=true]:-rotate-90"
        >
          ▼
        </span>
        {name}
      </button>
      {!collapse && (
        <div className="text-orange-text bg-border col-span-full grid grid-cols-subgrid gap-px">
          {children}
        </div>
      )}
    </>
  );
}

function TableRow({ parameter }: { parameter: string }) {
  return (
    <div className="*:bg-background hover:*:bg-selection-background col-span-full grid grid-cols-subgrid text-sm *:px-1">
      <div />
      <div className="line-clamp-1 text-ellipsis">{parameter}</div>
      <Value name={parameter} />
    </div>
  );
}

function Value({ name }: { name: string }) {
  const test = useAtomValue(parameterSubscriptionAtom(name));

  return Result.match(test, {
    onInitial: () => (
      <>
        <div className="text-muted-foreground text-right">Awaiting Value</div>
      </>
    ),
    onFailure: ({ cause }) => (
      <pre className="text-error col-span-full min-h-full text-center uppercase">
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
