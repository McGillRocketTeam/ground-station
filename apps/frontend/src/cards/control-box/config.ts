import type { ControlBoxCommandArrayEntry, ControlBoxCommandEntry } from "@/lib/command-config";

import { normalizeControlBoxCommandEntry } from "@/lib/command-config";

export type ControlBoxAction = {
  readonly command: string;
  readonly args: Readonly<Record<string, string>>;
};

export type ControlBoxStateSource = {
  readonly parameter: string;
  readonly activeValue: boolean | string;
};

export type ControlBoxControl = {
  readonly id: string;
  readonly label: string;
  readonly onActions: ReadonlyArray<ControlBoxAction>;
  readonly offActions: ReadonlyArray<ControlBoxAction>;
  readonly state: ReadonlyArray<ControlBoxStateSource>;
};

const WRITE_DIGITAL_PIN = "/EGSE/Pad/LabJack/write_digital_pin";

const flightAction = (command: string): ControlBoxAction => ({
  command: `/FlightComputer/${command}`,
  args: {},
});

const digitalAction = (pin: number, state: "HIGH" | "LOW"): ControlBoxAction => ({
  command: WRITE_DIGITAL_PIN,
  args: { pin_number: String(pin), pin_state: state },
});

const digitalControl = (
  id: string,
  label: string,
  pin: number,
  parameter: string,
): ControlBoxControl => ({
  id,
  label,
  onActions: [digitalAction(pin, "HIGH")],
  offActions: [digitalAction(pin, "LOW")],
  state: [{ parameter: `/EGSE/Pad/LabJack/${parameter}`, activeValue: "high" }],
});

const flightComputerState = (parameter: string): ReadonlyArray<ControlBoxStateSource> => [
  {
    parameter: `/SystemA/Rocket/FlightComputer/${parameter}`,
    activeValue: true,
  },
  {
    parameter: `/SystemB/Rocket/FlightComputer/${parameter}`,
    activeValue: true,
  },
];

export const ControlBoxControls: ReadonlyArray<ControlBoxControl> = [
  {
    id: "emergency-stop",
    label: "Emergency Stop",
    onActions: [flightAction("emergency_stop")],
    offActions: [flightAction("emergency_cancel")],
    state: [],
  },
  digitalControl("ign-minus", "IGN-", 21, "MIO1"),
  {
    id: "launch",
    label: "Launch",
    onActions: [flightAction("launch")],
    offActions: [],
    state: [],
  },
  digitalControl("la-ret-polarity", "LA RET Polarity", 4, "FIO4"),
  digitalControl("fill", "Fill", 0, "FIO0"),
  {
    id: "vent-la-ret-power",
    label: "Vent / LA RET Power",
    onActions: [digitalAction(6, "HIGH"), flightAction("vent_valve_energize")],
    offActions: [digitalAction(6, "LOW"), flightAction("vent_valve_de-energize")],
    state: [
      { parameter: "/EGSE/Pad/LabJack/FIO6", activeValue: "high" },
      ...flightComputerState("vent_energizedGate_HW"),
    ],
  },
  digitalControl("dump", "Dump", 1, "FIO1"),
  digitalControl("la-ret-power", "LA RET Power", 6, "FIO6"),
  {
    id: "fdov",
    label: "F/DOV",
    onActions: [flightAction("fdov_energize")],
    offActions: [flightAction("fdov_de-energize")],
    state: flightComputerState("fdov_energizedGate_HW"),
  },
  digitalControl("ign-plus", "IGN+", 20, "MIO0"),
  digitalControl("la-dis-power", "LA DIS Power", 7, "FIO7"),
  digitalControl("la-dis-polarity", "LA DIS Polarity", 5, "FIO5"),
  {
    id: "mov-arm",
    label: "MOV Arm",
    onActions: [flightAction("mov_arming")],
    offActions: [flightAction("mov_disarming")],
    state: flightComputerState("mov_armed_logical_SW"),
  },
];

const controlsById = new Map(ControlBoxControls.map((control) => [control.id, control]));

export function getControlBoxControl(entry: ControlBoxCommandEntry) {
  if (entry.controlId) return controlsById.get(entry.controlId);

  return ControlBoxControls.find((control) =>
    [...control.onActions, ...control.offActions].some(
      (action) =>
        action.command === entry.command &&
        Object.entries(action.args).every(([name, value]) => entry.args[name] === value),
    ),
  );
}

export function completeControlBoxEntries(
  configured: ReadonlyArray<ControlBoxCommandArrayEntry>,
): ReadonlyArray<ControlBoxCommandEntry> {
  const seenControlIds = new Set<string>();
  const normalized = configured
    .map(normalizeControlBoxCommandEntry)
    .map((entry): ControlBoxCommandEntry => {
      const control = getControlBoxControl(entry);
      return control
        ? {
            ...entry,
            controlId: control.id,
            localName: entry.localName ?? control.label,
          }
        : entry;
    })
    .filter((entry) => {
      const control = getControlBoxControl(entry);
      if (!control) return true;
      if (seenControlIds.has(control.id)) return false;

      seenControlIds.add(control.id);
      return true;
    });
  const configuredIds = new Set(
    normalized.flatMap((entry) => {
      const control = getControlBoxControl(entry);
      return control ? [control.id] : [];
    }),
  );
  const missing = ControlBoxControls.filter((control) => !configuredIds.has(control.id)).map(
    (control): ControlBoxCommandEntry => ({
      ...control.onActions[0],
      controlId: control.id,
      localName: control.label,
    }),
  );

  return [...normalized, ...missing];
}
