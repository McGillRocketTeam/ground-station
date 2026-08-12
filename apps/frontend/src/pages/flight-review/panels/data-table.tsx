import { useAtomSuspense } from "@effect/atom-react";
import { useState, type ReactNode } from "react";

import type { FlightReplayState } from "../data";

import { flightReplayStateAtom, flightStageLabel } from "../data";

const SYSTEM_A_ROOT = "/SystemA/Rocket/FlightComputer/";

const systemParameter = (name: string) => `${SYSTEM_A_ROOT}${name}`;

const BOOLEAN_PARAMETERS = [
  "_armed_HW",
  "_armed_SW",
  "_continuity_HW",
  "_energized_SW",
  "_energizedGate_HW",
  "_energizedCurrent_HW",
  "gps_fix_ok",
] as const;

const formatReplayValue = (name: string, value: number | string | undefined) => {
  if (value === undefined || value === "") return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  if (BOOLEAN_PARAMETERS.some((suffix) => name.endsWith(suffix))) {
    return numericValue > 0.5 ? "True" : "False";
  }
  return numericValue.toLocaleString();
};

export function DataTablePanel() {
  const data = useAtomSuspense(flightReplayStateAtom).value;
  return (
    <div className="w-full h-full overflow-auto">
      <div className="grid grid-cols-[1.5rem_minmax(12rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)] gap-px font-mono">
        <TableHeader />
        <TableGroup name="Flight">
          <TableRow
            parameter="Stage"
            systemAValue={flightStageLabel(
              data.currentPacket?.parameters[systemParameter("flight_stage")],
            )}
            systemBValue={flightStageLabel(
              data.currentPacket?.parameters[
                systemParameter("flight_stage").replace("SystemA", "SystemB")
              ],
            )}
          />
          <ReplayParameterRow
            data={data}
            label="Altitude AGL (ft)"
            name="barometer_altitude_from_pad"
          />
          <ReplayParameterRow data={data} label="Vertical speed (ft/s)" name="vertical_speed" />
          <ReplayParameterRow data={data} label="Apogee (ft)" name="apogee_from_ground" />
        </TableGroup>
        <TableGroup name="Drogue recovery">
          <ReplayParameterRow data={data} label="Electrical armed" name="drogue_armed_HW" />
          <ReplayParameterRow data={data} label="Logical armed" name="drogue_armed_SW" />
          <ReplayParameterRow data={data} label="Continuity" name="drogue_continuity_HW" />
          <ReplayParameterRow data={data} label="Software command" name="drogue_energized_SW" />
          <ReplayParameterRow data={data} label="Gate energized" name="drogue_energizedGate_HW" />
          <ReplayParameterRow
            data={data}
            label="Current confirmed"
            name="drogue_energizedCurrent_HW"
          />
          <ReplayParameterRow
            data={data}
            label="Deployment altitude (ft)"
            name="drouge_deployment_from_ground"
          />
        </TableGroup>
        <TableGroup name="Main recovery">
          <ReplayParameterRow data={data} label="Electrical armed" name="main_armed_HW" />
          <ReplayParameterRow data={data} label="Logical armed" name="main_armed_SW" />
          <ReplayParameterRow data={data} label="Continuity" name="main_continuity_HW" />
          <ReplayParameterRow data={data} label="Software command" name="main_energized_SW" />
          <ReplayParameterRow data={data} label="Gate energized" name="main_energizedGate_HW" />
          <ReplayParameterRow
            data={data}
            label="Current confirmed"
            name="main_energizedCurrent_HW"
          />
          <ReplayParameterRow
            data={data}
            label="Deployment altitude (ft)"
            name="main_deployment_from_ground"
          />
        </TableGroup>
        <TableGroup name="GPS">
          <ReplayParameterRow data={data} label="Latitude" name="gps_latitude" />
          <ReplayParameterRow data={data} label="Longitude" name="gps_longitude" />
          <ReplayParameterRow data={data} label="Altitude" name="gps_altitude" />
          <ReplayParameterRow data={data} label="Fix OK" name="gps_fix_ok" />
          <ReplayParameterRow data={data} label="Fix type" name="gps_fix_type" />
          <ReplayParameterRow
            data={data}
            label="Horizontal accuracy (m)"
            name="gps_horizontal_accuracy"
          />
          <ReplayParameterRow
            data={data}
            label="Vertical accuracy (m)"
            name="gps_vertical_accuracy"
          />
        </TableGroup>
        <TableGroup name="Landing prediction">
          <ReplayParameterRow
            data={data}
            label="Predicted latitude"
            name="predicted_location_latitude"
          />
          <ReplayParameterRow
            data={data}
            label="Predicted longitude"
            name="predicted_location_longitude"
          />
          <ReplayParameterRow
            data={data}
            label="Search radius (m)"
            name="predicted_location_accuracy"
          />
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

function ReplayParameterRow({
  data,
  label,
  name,
}: {
  data: FlightReplayState;
  label: string;
  name: string;
}) {
  const systemAParameter = systemParameter(name);
  const systemBParameter = systemAParameter.replace("SystemA", "SystemB");
  return (
    <TableRow
      parameter={label}
      systemAValue={formatReplayValue(name, data.currentPacket?.parameters[systemAParameter])}
      systemBValue={formatReplayValue(name, data.currentPacket?.parameters[systemBParameter])}
    />
  );
}

function TableRow({
  parameter,
  systemAValue,
  systemBValue,
}: {
  parameter: string;
  systemAValue: number | string | undefined;
  systemBValue: number | string | undefined;
}) {
  return (
    <div className="col-span-full grid grid-cols-subgrid text-sm *:bg-background *:px-1 hover:*:bg-selection-background data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]">
      <div />
      <div className="line-clamp-1 text-ellipsis text-left" title={parameter}>
        {parameter}
      </div>
      <div className="text-right">{systemAValue ?? "-"}</div>
      <div className="text-right">{systemBValue ?? "-"}</div>
    </div>
  );
}
