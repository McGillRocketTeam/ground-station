import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { memo, useState, type ReactNode } from "react";

import type { LiveParameterUpdate } from "@/lib/atom";

import { parameterInfoAtom, parameterSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { cn } from "@/lib/utils";

const SYSTEM_A_PREFIX = "SystemB/Rocket/FlightComputer";

const CardEntries = {
  "FLIGHT ATOMIC": [
    "flight_stage",
    "barometer_altitude_from_pad",
    "barometer_altitude_from_sea_level",
    "apogee_from_ground",
    "fc_pressure",
    "fc_temp",
    "gps_latitude",
    "gps_longitude",
    "gps_altitude",
    "gps_time_last_update",
    "vertical_speed",
    "acceleration_x",
    "acceleration_y",
    "acceleration_z",
    "gyro_rate_x",
    "gyro_rate_y",
    "gyro_rate_z",
    "fc_rssi",
    "fc_snr",
    "battery_voltage",
    "battery_current_draw",
    "flags",
    "flags_post_pad",
    "flags_bool_lead_pad",
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
    "mov_armed_logical_SW",
    "mov_energized_SW",
    "vent_armed_SW",
    "vent_energized_SW",
  ],
};

const ParameterTableSectionSchema = Schema.Struct({
  parameters: Schema.Array(Schema.String).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "Parameters" }),
  ),
  title: Schema.String.pipe(Schema.annotate({ [FormTitleAnnotationId]: "Section Title" })),
});

export type ParameterTableSection = typeof ParameterTableSectionSchema.Type;

const DEFAULT_PARAMETER_TABLE_SECTIONS: ReadonlyArray<ParameterTableSection> = Object.entries(
  CardEntries,
).map(([title, parameters]) => ({
  title,
  parameters: parameters.map((parameter) => `/${SYSTEM_A_PREFIX}/${parameter}`),
}));

export const ParameterTable = makeCard({
  id: "parameter-table",
  name: "Parameter Table",
  schema: Schema.Struct({
    sections: Schema.optional(Schema.Array(ParameterTableSectionSchema)).pipe(
      Schema.annotate({
        [FormTitleAnnotationId]: "Sections",
        [FormTypeAnnotationId]: "parameterTableSections",
      }),
    ),
  }),
  component: (props) => {
    const sections = props.params.sections ?? DEFAULT_PARAMETER_TABLE_SECTIONS;

    return (
      <div className="h-full overflow-auto">
        <div className="grid grid-cols-[1.5rem_minmax(12rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)] gap-px font-mono">
          <TableHeader />
          {sections.map((section) => (
            <TableGroup key={section.title} name={section.title}>
              {section.parameters.map((parameter) => (
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
});

const TableRow = memo(function TableRow({ parameter }: { parameter: string }) {
  const info = useAtomSuspense(parameterInfoAtom(parameter)).value;

  return (
    <div className="col-span-full grid grid-cols-subgrid text-sm *:bg-background *:px-1 hover:*:bg-selection-background">
      <div />
      <div className="line-clamp-1 text-ellipsis" title={parameter}>
        {info.shortDescription ?? info.qualifiedName}
      </div>
      <Value name={parameter.replace("SystemB", "SystemA")} />
      {parameter.includes("SystemA") && <Value name={parameter.replace("SystemA", "SystemB")} />}
      {/* <div /> */}
    </div>
  );
});

const Value = memo(function Value({ name }: { name: string }) {
  const result: AsyncResult.AsyncResult<LiveParameterUpdate, unknown> = useAtomValue(
    parameterSubscriptionAtom(name),
  );

  const double = !name.includes("SystemA") && !name.includes("SystemB");

  return AsyncResult.match(result, {
    onInitial: () => (
      <>
        <div className={cn("text-right text-muted-foreground", double && "col-span-2")}>
          Awaiting Value
        </div>
      </>
    ),
    onFailure: ({ cause }) => (
      <pre className="col-span-full min-h-full text-center text-error uppercase">
        {Cause.pretty(cause)}
      </pre>
    ),
    onSuccess: ({ value }) => (
      <>
        <div className={cn("line-clamp-1 text-right text-ellipsis", double && "col-span-2")}>
          {"value" in value.value.engValue
            ? value.value.engValue.value.toLocaleString()
            : "Unknown Value Type"}
        </div>
      </>
    ),
  });
});
