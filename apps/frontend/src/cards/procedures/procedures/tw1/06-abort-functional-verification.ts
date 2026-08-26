import { ProcedureStep } from "@mrt/yamcs-effect";

const valveArmConditions = [
  {
    parameter: "/SystemA/Rocket/FlightComputer/fdov_armed_SW",
    operator: "eq" as const,
    value: true,
    display: { row: "F/DOV", column: "logicalArm" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/fdov_armed_HW",
    operator: "eq" as const,
    value: true,
    display: { row: "F/DOV", column: "electricalArm" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/fdov_continuity_HW",
    operator: "eq" as const,
    value: true,
    display: { row: "F/DOV", column: "continuity" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/vent_armed_SW",
    operator: "eq" as const,
    value: true,
    display: { row: "Vent Valve", column: "logicalArm" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/vent_armed_HW",
    operator: "eq" as const,
    value: true,
    display: { row: "Vent Valve", column: "electricalArm" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/vent_continuity_HW",
    operator: "eq" as const,
    value: true,
    display: { row: "Vent Valve", column: "continuity" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/mov_armed_logical_SW",
    operator: "eq" as const,
    value: false,
    display: { row: "MOV", column: "logicalArm" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/mov_armed_electrical_HW",
    operator: "eq" as const,
    value: false,
    display: { row: "MOV", column: "electricalArm" },
  },
  {
    parameter: "/SystemA/Rocket/FlightComputer/mov_continuity_HW",
    operator: "eq" as const,
    value: true,
    display: { row: "MOV", column: "continuity" },
  },
];

const energizedConditions = (device: "fdov" | "vent", row: string) => [
  {
    parameter: `/SystemA/Rocket/FlightComputer/${device}_energized_SW`,
    operator: "eq" as const,
    value: true,
    display: { row, column: "logicalEnergized" },
  },
  {
    parameter: `/SystemA/Rocket/FlightComputer/${device}_energizedGate_HW`,
    operator: "eq" as const,
    value: true,
    display: { row, column: "energizeGate" },
  },
  {
    parameter: `/SystemA/Rocket/FlightComputer/${device}_energizedCurrent_HW`,
    operator: "eq" as const,
    value: false,
    display: { row, column: "energizeCurrent" },
  },
];

const energizedPresentation = {
  type: "truthTable" as const,
  columns: [
    { id: "logicalEnergized", label: "Logical Energize" },
    { id: "energizeGate", label: "Energize Gate" },
    { id: "energizeCurrent", label: "Energize Current" },
  ],
};

export const abortFunctionalVerificationSteps = [
  ProcedureStep.make({ type: "note", text: "Abort Functional Verification", color: "#FFF798" }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 64,
    role: "CSH",
    name: "/FlightComputer/reset_prop_boards_valve_state",
    comment: "Press the command stack button to Reset Prop Valve States.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 65,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalArm", label: "Logical Arm" },
        { id: "electricalArm", label: "Electrical Arm" },
        { id: "continuity", label: "Electrical Continuity" },
      ],
    },
    condition: valveArmConditions,
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 66,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  off   off on",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      on   off   off on",
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 67,
    role: "CSH",
    name: "/FlightComputer/fdov_energize",
    comment: "Set the F/DOV switch to ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 68,
    role: "CSC",
    presentation: energizedPresentation,
    condition: energizedConditions("fdov", "F/DOV"),
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 69,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      off  on    off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 70,
    role: "CSH",
    name: "/FlightComputer/vent_valve_energize",
    comment: "Set the Vent switch to ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 71,
    role: "CSC",
    presentation: energizedPresentation,
    condition: energizedConditions("vent", "Vent"),
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 72,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  on    off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 73,
    role: "CSH",
    name: "/FlightComputer/mov_arming",
    comment: "Insert and turn the key switch clockwise to set MOV to ARMED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 74,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalArm", label: "Logical Arm" },
        { id: "electricalArm", label: "Electrical Arm" },
      ],
    },
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_armed_logical_SW",
        operator: "eq",
        value: true,
        display: { row: "MOV", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_armed_electrical_HW",
        operator: "eq",
        value: true,
        display: { row: "MOV", column: "electricalArm" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 75,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 76,
    role: "CSH",
    name: "/FlightComputer/umbilical_to_battery",
    comment: "Press the command stack button to set Umbilical Low.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 77,
    role: "CSC",
    presentation: { type: "truthTable", columns: [{ id: "state", label: "State" }] },
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/external_power_sw",
        operator: "eq",
        value: false,
        display: { row: "External Power SW", column: "state" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/external_power_hw",
        operator: "eq",
        value: true,
        display: { row: "External Power HW", column: "state" },
      },
    ],
    delay: 0,
    comment: "Confirm that the completion ACK is received.\nConfirm the following states:",
  }),
  ProcedureStep.make({
    type: "note",
    text: "CSH & PRC: The next 3 steps must be completed within 5 seconds.",
    color: "#FEBFBF",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 78,
    role: "CSH",
    name: "/FlightComputer/launch",
    comment: "Press the Launch button.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 79,
    role: "PRC",
    text: "Confirm MOV solenoid actuation.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 80,
    role: "CSH",
    name: "/FlightComputer/emergency_stop",
    comment: "Press the E-Stop Button.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 81,
    role: "CSC",
    presentation: energizedPresentation,
    condition: ["fdov", "mov", "vent"].flatMap((device) => [
      {
        parameter: `/SystemA/Rocket/FlightComputer/${device}_energized_SW`,
        operator: "eq" as const,
        value: false,
        display: {
          row: device === "fdov" ? "F/DOV" : device === "mov" ? "MOV" : "Vent",
          column: "logicalEnergized",
        },
      },
      {
        parameter: `/SystemA/Rocket/FlightComputer/${device}_energizedGate_HW`,
        operator: "eq" as const,
        value: false,
        display: {
          row: device === "fdov" ? "F/DOV" : device === "mov" ? "MOV" : "Vent",
          column: "energizeGate",
        },
      },
      {
        parameter: `/SystemA/Rocket/FlightComputer/${device}_energizedCurrent_HW`,
        operator: "eq" as const,
        value: false,
        display: {
          row: device === "fdov" ? "F/DOV" : device === "mov" ? "MOV" : "Vent",
          column: "energizeCurrent",
        },
      },
    ]),
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 82,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  off   off on",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 83,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 84,
    role: "CSH",
    name: "/FlightComputer/disarm_recovery",
    comment: "Press the command stack button to set Recovery Disarm.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 85,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalArm", label: "Logical Arm" },
        { id: "electricalArm", label: "Electrical Arm" },
        { id: "continuity", label: "Electrical Continuity" },
      ],
    },
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/drogue_armed_SW",
        operator: "eq",
        value: false,
        display: { row: "Drogue", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/drogue_armed_HW",
        operator: "eq",
        value: false,
        display: { row: "Drogue", column: "electricalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/drogue_continuity_HW",
        operator: "eq",
        value: false,
        display: { row: "Drogue", column: "continuity" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/main_armed_SW",
        operator: "eq",
        value: false,
        display: { row: "Main", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/main_armed_HW",
        operator: "eq",
        value: false,
        display: { row: "Main", column: "electricalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/main_continuity_HW",
        operator: "eq",
        value: false,
        display: { row: "Main", column: "continuity" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the ejection channel states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 86,
    role: "AVC",
    text: [
      "Confirm the LEDs on the FC-A Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  off   off off",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      off  off   off off",
      "Confirm the LEDs on the FC-B Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  off   off off",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      off  off   off off",
    ].join("\n"),
  }),
];
