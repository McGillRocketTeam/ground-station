import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { Cause } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useLayoutEffect, useRef, useState } from "react";

import { colors, currentThemeAtom } from "../colors";
import {
  parameterSubscriptionAtom,
  YAMCS_INSTANCE,
  YamcsAtomHttpClient,
} from "../data/atom";
import { Text } from "./text";

const parameterColumns = {
  gutter: 3,
  name: 36,
  fca: 16,
  fcb: 16,
} as const;

const flightComputerPath = (system: "SystemA" | "systemB", name: string) =>
  `/${system}/Rocket/FlightComputer/${name}`;

const formatParameterValue = (value: unknown) =>
  (typeof value === "number" ? value.toFixed(3) : String(value)).toLocaleUpperCase();

const parameterValueColor = (value: unknown) => {
  if (typeof value !== "boolean") {
    return undefined;
  }

  return value ? colors.green : colors.fl_red;
};

const parameterGroups = [
  {
    title: "FLIGHT COMPUTER",
    names: [
      "acceleration_x",
      "acceleration_y",
      "acceleration_z",
      "gyro_rate_x",
      "gyro_rate_y",
      "gyro_rate_z",
      "barometer_altitude_from_pad",
      "barometer_altitude_from_sea_level",
      "apogee_from_ground",
      "vertical_speed",
      "flight_stage",
      "fc_pressure",
      "fc_temp",
      "fc_rssi",
      "fc_snr",
      "battery_voltage",
      "battery_current_draw",
      "call_sign",
      "flags",
      "seq",
    ],
  },
  {
    title: "GPS",
    names: [
      "gps_altitude",
      "gps_latitude",
      "gps_longitude",
      "gps_time_last_update",
    ],
  },
  {
    title: "PROPULSION",
    names: [
      "cc_pressure",
      "tank_pressure",
      "tank_temp",
      "prop_energized_electric",
      "vent_armed_HW",
      "vent_armed_SW",
      "vent_continuity_HW",
      "vent_energized_SW",
      "vent_energizedCurrent_HW",
      "vent_energizedGate_HW",
      "vent_temp",
      "mov_armed_electrical_HW",
      "mov_armed_logical_SW",
      "mov_continuity_HW",
      "mov_energized_SW",
      "mov_energizedCurrent_HW",
      "mov_energizedGate_HW",
      "mov_hall_state",
    ],
  },
  {
    title: "RECOVERY",
    names: [
      "drogue_armed_HW",
      "drogue_armed_SW",
      "drogue_continuity_HW",
      "drogue_energized_SW",
      "drogue_energizedCurrent_HW",
      "drogue_energizedGate_HW",
      "drouge_deployment_from_ground",
      "main_armed_HW",
      "main_armed_SW",
      "main_continuity_HW",
      "main_energized_SW",
      "main_energizedCurrent_HW",
      "main_energizedGate_HW",
      "main_deployment_from_ground",
      "fdov_armed_HW",
      "fdov_armed_SW",
      "fdov_continuity_HW",
      "fdov_energized_SW",
      "fdov_energizedCurrent_HW",
      "fdov_energizedGate_HW",
    ],
  },
  {
    title: "STORAGE",
    names: ["sd_card_deletion_armed", "sd_card_file_open"],
  },
] as const;

type ParameterTableRow =
  | { readonly _tag: "group"; readonly title: string }
  | { readonly _tag: "spacer"; readonly key: string }
  | {
      readonly _tag: "parameter";
      readonly name: string;
      readonly description: string;
      readonly fcaPath: string;
      readonly fcbPath: string;
    };

export function ParameterTable() {
  const { parameters } = useAtomSuspense(
    YamcsAtomHttpClient.query("mdb", "listParameters", {
      params: { instance: YAMCS_INSTANCE },
      query: {},
    }),
  ).value;
  const theme = useAtomValue(currentThemeAtom);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const parameterDescriptions = new Map(
    parameters.flatMap((parameter) => {
      const name = parameter.qualifiedName.split("/").at(-1);
      return name && parameter.shortDescription
        ? [[name, parameter.shortDescription] as const]
        : [];
    }),
  );
  const tableRows = parameterGroups.flatMap((group) => {
    const rows: ParameterTableRow[] = group.names.flatMap((name) => {
      const description = parameterDescriptions.get(name);
      return description
        ? [
            {
              _tag: "parameter" as const,
              name,
              description,
              fcaPath: flightComputerPath("SystemA", name),
              fcbPath: flightComputerPath("systemB", name),
            },
          ]
        : [];
    });

    return rows.length === 0
      ? []
      : [
          [{ _tag: "spacer" as const, key: group.title }],
          [{ _tag: "group" as const, title: group.title }],
          rows,
        ].flat();
  });
  const selectableRows = tableRows.filter((row) => row._tag === "parameter");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRow = selectableRows[selectedIndex];
  const selectedRenderIndex = selectedRow
    ? tableRows.findIndex(
        (row) => row._tag === "parameter" && row.name === selectedRow.name,
      )
    : 0;
  const pendingGotoTopRef = useRef(false);

  useKeyboard((key) => {
    if (key.ctrl || key.meta || selectableRows.length === 0) {
      return;
    }

    if (key.name !== "g") {
      pendingGotoTopRef.current = false;
    }

    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((index) => Math.max(0, index - 1));
    }

    if (key.name === "down" || key.name === "j") {
      setSelectedIndex((index) =>
        Math.min(selectableRows.length - 1, index + 1),
      );
    }

    if (key.name === "g" && key.shift) {
      setSelectedIndex(selectableRows.length - 1);
      pendingGotoTopRef.current = false;
    } else if (key.name === "g") {
      if (pendingGotoTopRef.current) {
        setSelectedIndex(0);
        pendingGotoTopRef.current = false;
      } else {
        pendingGotoTopRef.current = true;
      }
    }

    if (key.name === "G") {
      setSelectedIndex(selectableRows.length - 1);
    }
  });

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || selectableRows.length === 0) {
      return;
    }

    const viewportHeight = scroll.viewport.height;
    if (viewportHeight <= 0) {
      return;
    }

    const viewportTop = Math.floor(scroll.scrollTop);
    const viewportBottom = viewportTop + viewportHeight;

    const scrollMargin = 1;
    const topEdge = viewportTop + scrollMargin;
    const bottomEdge = viewportBottom - scrollMargin - 1;

    if (selectedRenderIndex < topEdge) {
      scroll.scrollTo({
        x: 0,
        y: Math.max(0, selectedRenderIndex - scrollMargin),
      });
    } else if (selectedRenderIndex > bottomEdge) {
      scroll.scrollTo({
        x: 0,
        y: Math.max(0, selectedRenderIndex - viewportHeight + scrollMargin + 1),
      });
    }
  }, [selectableRows.length, selectedRenderIndex]);

  return (
    <box flexGrow={1}>
      <box flexDirection="row" gap={1} height={1}>
        <ParameterCell width={parameterColumns.gutter}> </ParameterCell>
        <ParameterCell width={parameterColumns.name}>PARAMETER</ParameterCell>
        <ParameterCell width={parameterColumns.fca}>FC A</ParameterCell>
        <ParameterCell width={parameterColumns.fcb}>FC B</ParameterCell>
      </box>
      <scrollbox
        ref={scrollRef}
        focusable={false}
        flexGrow={1}
        scrollbarOptions={{ visible: false }}
      >
        {tableRows.map((row) => {
          if (row._tag === "spacer") {
            return <box key={row.key} height={1} />;
          }

          if (row._tag === "group") {
            return (
              <box key={row.title} flexDirection="row" gap={1}>
                <ParameterCell width={parameterColumns.gutter}> </ParameterCell>
                <ParameterCell
                  attributes={TextAttributes.BOLD}
                  width={parameterColumns.name}
                >
                  {row.title + " SUBSYSTEM"}
                </ParameterCell>
              </box>
            );
          }

          const selectableIndex = selectableRows.findIndex(
            (selectableRow) => selectableRow.name === row.name,
          );
          const isSelected = selectableIndex === selectedIndex;

          return (
            <box
              backgroundColor={isSelected ? theme.selection : theme.background}
              key={row.name}
              flexDirection="row"
              gap={1}
            >
              <ParameterGutter selected={isSelected} />
              <ParameterCell
                width={parameterColumns.name}
                selected={isSelected}
              >
                {row.description.toLocaleUpperCase()}
              </ParameterCell>
              <ParameterValueCell name={row.fcaPath} selected={isSelected} />
              <ParameterValueCell name={row.fcbPath} selected={isSelected} />
            </box>
          );
        })}
      </scrollbox>
    </box>
  );
}

function ParameterGutter({ selected }: { selected: boolean }) {
  const theme = useAtomValue(currentThemeAtom);

  return (
    <box width={parameterColumns.gutter} overflow="hidden">
      <Text
        bg={selected ? theme.selection : theme.gutter}
        fg={selected ? theme.gutterForegroundHighlight : theme.gutterForeground}
      >
        {selected ? " ▶ " : "   "}
      </Text>
    </box>
  );
}

function ParameterValueCell({
  name,
  selected,
}: {
  name: string;
  selected: boolean;
}) {
  const result = useAtomValue(parameterSubscriptionAtom(name));

  return AsyncResult.match(result, {
    onInitial: () => (
      <ParameterCell truncate width={parameterColumns.fca} selected={selected}>
        AWAITING
      </ParameterCell>
    ),
    onFailure: ({ cause }) => (
      <ParameterCell truncate width={parameterColumns.fca} selected={selected}>
        {Cause.pretty(cause).toLocaleUpperCase()}
      </ParameterCell>
    ),
    onSuccess: ({ value }) => (
      <ParameterCell
        fg={"value" in value.engValue ? parameterValueColor(value.engValue.value) : undefined}
        width={parameterColumns.fca}
        selected={selected}
        truncate
      >
        {"value" in value.engValue ? formatParameterValue(value.engValue.value) : "UNKNOWN"}
      </ParameterCell>
    ),
  });
}

function ParameterCell({
  attributes,
  children,
  fg,
  selected = false,
  truncate = false,
  width,
}: {
  attributes?: number;
  children: string;
  fg?: string;
  selected?: boolean;
  truncate?: boolean;
  width: number;
}) {
  const theme = useAtomValue(currentThemeAtom);
  const content = truncate ? children.slice(0, width) : children;

  return (
    <box width={width} overflow="hidden">
      <Text
        attributes={attributes}
        bg={selected ? theme.selection : theme.background}
        fg={fg ?? (selected ? theme.selectionForeground : theme.foreground)}
      >
        {content}
      </Text>
    </box>
  );
}
