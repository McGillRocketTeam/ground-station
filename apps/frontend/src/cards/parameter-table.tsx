import { Result, useAtomValue } from "@effect-atom/atom-react";
import { parameterSubscriptionAtom } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";
import { useState, type ReactNode } from "react";

import { makeCard } from "@/lib/cards";

const CardEntries = {
  "FLIGHT ATOMIC": [
    "FC435/FlightComputer/flight_stage",
    "FC435/FlightComputer/altimeter_altitude",
    "FC435/FlightComputer/altitude_from_sea_level",
    "FC435/FlightComputer/apogee_from_ground",
    "FC435/FlightComputer/atm_pressure",
    "FC435/FlightComputer/barometer_altitude",
    "FC435/FlightComputer/atm_temp",
    "FC435/FlightComputer/gps_latitude",
    "FC435/FlightComputer/gps_longitude",
    "FC435/FlightComputer/gps_altitude",
    "FC435/FlightComputer/gps_time_last_update",
    "FC435/FlightComputer/vertical_speed",
    "FC435/FlightComputer/acceleration_x",
    "FC435/FlightComputer/acceleration_y",
    "FC435/FlightComputer/acceleration_z",
    "FC435/FlightComputer/angle_yaw",
    "FC435/FlightComputer/angle_pitch",
    "FC435/FlightComputer/angle_roll",
    "FC435/FlightComputer/fc_rssi",
    "FC435/FlightComputer/fc_snr",
    "FC435/FlightComputer/flags",
    "FC435/FlightComputer/flags_post_pad",
    "FC435/FlightComputer/flags_pre_pad",
    "FC435/FlightComputer/flight_atomic_flag",
    "FC435/FlightComputer/states_atomic_flag",
    "FC435/FlightComputer/seq",
    "FC435/FlightComputer/padding",
  ],
  "RADIO ATOMIC": [
    "FC435/FlightComputer/call_sign",
    "FC435/FlightComputer/radio_atomic_flag",
  ],
  "PROPULSION ATOMIC": [
    "FC435/FlightComputer/cc_pressure",
    "FC435/FlightComputer/tank_pressure",
    "FC435/FlightComputer/tank_temp",
    "FC435/FlightComputer/vent_temp",
    "FC435/FlightComputer/prop_atomic_flag",
    "FC435/FlightComputer/prop_energized_electric",
    "FC435/FlightComputer/mov_hall_state",
    "FC435/FlightComputer/drogue_armed_SW",
    "FC435/FlightComputer/drogue_energized_SW",
    "FC435/FlightComputer/fdov_armed_SW",
    "FC435/FlightComputer/fdov_energized_SW",
    "FC435/FlightComputer/main_armed_SW",
    "FC435/FlightComputer/main_energized_SW",
    "FC435/FlightComputer/mov_armed_SW",
    "FC435/FlightComputer/mov_energized_SW",
    "FC435/FlightComputer/vent_armed_SW",
    "FC435/FlightComputer/vent_energized_SW",
  ],
};

export const ParameterTable = makeCard({
  id: "parameter-table",
  name: "Parameter Table",
  schema: Schema.Struct({}),
  component: () => {
    return (
      <div className="h-full overflow-auto">
        <div className="grid grid-cols-[1.5rem_auto_1fr_1fr] gap-px font-mono">
          <TableHeader />
          {Object.entries(CardEntries).map(([title, parameters]) => (
            <TableGroup key={title} name={title}>
              {parameters.map((parameter) => (
                <TableRow key={parameter} parameter={parameter} />
              ))}
            </TableGroup>
          ))}
        </div>
      </div>
    );
  },
});

function TableHeader() {
  return (
    <div className="text-white-text sticky top-0 z-10 col-span-full grid grid-cols-subgrid text-sm uppercase">
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1" />
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        Parameter
      </div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        FC435
      </div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        FC903
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
        onClick={() => setCollapse((prev) => !prev)}
        className="text-white-text bg-background-secondary hover:bg-background-secondary-highlight border-t-background-secondary-highlight col-span-full border-t text-left text-sm"
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
      <div className="line-clamp-1 text-ellipsis">
        {parameter.split("/")[2]}
      </div>
      <Value name={"/" + parameter} />
      <Value name={"/" + parameter.replace("435", "903")} />
      {/* <div /> */}
    </div>
  );
}

function Value({ name }: { name: string }) {
  const result = useAtomValue(parameterSubscriptionAtom(name));

  return Result.match(result, {
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
        <div className="line-clamp-1 text-right text-ellipsis">
          {"value" in value.engValue
            ? value.engValue.value.toLocaleString()
            : "Unknown Value Type"}
        </div>
      </>
    ),
  });
}
