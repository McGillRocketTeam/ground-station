import { useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { memo, useState, type ReactNode } from "react";

import { parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

const SYSTEM_A_PREFIX = "SystemA/Rocket/FlightComputer";
const SYSTEM_B_PREFIX = "SystemB/Rocket/FlightComputer";

const CardEntries = {
  "FLIGHT ATOMIC": [
    "flight_stage",
    "altimeter_altitude",
    "altitude_from_sea_level",
    "apogee_from_ground",
    "atm_pressure",
    "barometer_altitude",
    "atm_temp",
    "gps_latitude",
    "gps_longitude",
    "gps_altitude",
    "gps_time_last_update",
    "vertical_speed",
    "acceleration_x",
    "acceleration_y",
    "acceleration_z",
    "angle_yaw",
    "angle_pitch",
    "angle_roll",
    "fc_rssi",
    "fc_snr",
    "flags",
    "flags_post_pad",
    "flags_pre_pad",
    "flight_atomic_flag",
    "states_atomic_flag",
    "seq",
    "padding",
  ],
  "RADIO ATOMIC": ["call_sign", "radio_atomic_flag"],
  "PROPULSION ATOMIC": [
    "cc_pressure",
    "tank_pressure",
    "tank_temp",
    "vent_temp",
    "prop_atomic_flag",
    "prop_energized_electric",
    "mov_hall_state",
    "drogue_armed_SW",
    "drogue_energized_SW",
    "fdov_armed_SW",
    "fdov_energized_SW",
    "main_armed_SW",
    "main_energized_SW",
    "mov_armed_SW",
    "mov_energized_SW",
    "vent_armed_SW",
    "vent_energized_SW",
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

const TableHeader = memo(function TableHeader() {
  return (
    <div className="text-white-text sticky top-0 z-10 col-span-full grid grid-cols-subgrid text-sm uppercase">
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1" />
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        Parameter
      </div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        SystemA
      </div>
      <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1">
        SystemB
      </div>
      {/* <div className="bg-background-secondary border-t-background-secondary-highlight border-t px-1"> */}
      {/*   Unit */}
      {/* </div> */}
    </div>
  );
});

const TableGroup = memo(function TableGroup({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) {
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
});

const TableRow = memo(function TableRow({ parameter }: { parameter: string }) {
  return (
    <div className="*:bg-background hover:*:bg-selection-background col-span-full grid grid-cols-subgrid text-sm *:px-1">
      <div />
      <div className="line-clamp-1 text-ellipsis">{parameter}</div>
      <Value name={`/${SYSTEM_A_PREFIX}/${parameter}`} />
      <Value name={`/${SYSTEM_B_PREFIX}/${parameter}`} />
      {/* <div /> */}
    </div>
  );
});

const Value = memo(function Value({ name }: { name: string }) {
  const result = useAtomValue(parameterSubscriptionAtom(name));

  return AsyncResult.match(result, {
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
});
