import { ProcedureStep } from "@mrt/yamcs-effect";

export const abortFunctionalVerificationSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Abort Functional Verification",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 53,
    role: "CSH",
    name: "/FlightComputer/reset_prop_boards_valve_state",
    comment: "Press the command stack button to Reset Prop Valve States.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 54,
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
        parameter: "/SystemA/Rocket/FlightComputer/fdov_armed_SW",
        operator: "eq",
        value: true,
        display: { row: "F/DOV", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_armed_HW",
        operator: "eq",
        value: true,
        display: { row: "F/DOV", column: "electricalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_continuity_HW",
        operator: "eq",
        value: true,
        display: { row: "F/DOV", column: "continuity" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_armed_SW",
        operator: "eq",
        value: true,
        display: { row: "Vent Valve", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_armed_HW",
        operator: "eq",
        value: true,
        display: { row: "Vent Valve", column: "electricalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_continuity_HW",
        operator: "eq",
        value: true,
        display: { row: "Vent Valve", column: "continuity" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_armed_logical_SW",
        operator: "eq",
        value: false,
        display: { row: "MOV", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_armed_electrical_HW",
        operator: "eq",
        value: false,
        display: { row: "MOV", column: "electricalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_continuity_HW",
        operator: "eq",
        value: true,
        display: { row: "MOV", column: "continuity" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 55,
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
    stepNumber: 56,
    role: "CSH",
    comment: "Insert and turn the key switch clockwise to set MOV to ARMED.",
    name: "/FlightComputer/mov_arming",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 57,
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
    stepNumber: 58,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 59,
    role: "CSH",
    name: "/FlightComputer/fdov_energize",
    comment: "Set the F/DOV switch to ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 60,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalEnergized", label: "Logical Energize" },
        { id: "energizeGate", label: "Energize Gate" },
        { id: "energizeCurrent", label: "Energize Current" },
      ],
    },
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_energized_SW",
        operator: "eq",
        value: true,
        display: { row: "F/DOV", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_energizedGate_HW",
        operator: "eq",
        value: true,
        display: { row: "F/DOV", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "F/DOV", column: "energizeCurrent" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 61,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      on   on    on  on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 62,
    role: "CSH",
    name: "/FlightComputer/vent_valve_energize",
    comment: "Set the Vent switch to ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 63,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalEnergized", label: "Logical Energize" },
        { id: "energizeGate", label: "Energize Gate" },
        { id: "energizeCurrent", label: "Energize Current" },
      ],
    },
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energized_SW",
        operator: "eq",
        value: true,
        display: { row: "Vent", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedGate_HW",
        operator: "eq",
        value: true,
        display: { row: "Vent", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "Vent", column: "energizeCurrent" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 64,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  CON  GATE  EN  ARM",
      "  CH1      on   on    on  on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "note",
    text: "CSH & PRC: The next 3 steps must be completed within 5 seconds.",
    color: "#FEBFBF",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 65,
    role: "CSH",
    comment: "Press the Launch button.",
    name: "/FlightComputer/launch",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 66,
    role: "PRC",
    text: "Confirm MOV solenoid actuation.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 67,
    role: "CSH",
    name: "/FlightComputer/emergency_stop",
    comment: "Press the E-Stop Button.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 68,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalEnergized", label: "Logical Energize" },
        { id: "energizeGate", label: "Energize Gate" },
        { id: "energizeCurrent", label: "Energize Current" },
      ],
    },
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_energized_SW",
        operator: "eq",
        value: false,
        display: { row: "F/DOV", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_energizedGate_HW",
        operator: "eq",
        value: false,
        display: { row: "F/DOV", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/fdov_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "F/DOV", column: "energizeCurrent" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_energized_SW",
        operator: "eq",
        value: false,
        display: { row: "MOV", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_energizedGate_HW",
        operator: "eq",
        value: false,
        display: { row: "MOV", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "MOV", column: "energizeCurrent" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energized_SW",
        operator: "eq",
        value: false,
        display: { row: "Vent", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedGate_HW",
        operator: "eq",
        value: false,
        display: { row: "Vent", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "Vent", column: "energizeCurrent" },
      },
    ],
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
      "  CH1      on   off   off off",
      "  CH2      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 70,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  CON  GATE  EN  ARM",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 71,
    role: "AVC",
    text: "Turn off the Power Supply.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 72,
    role: "AVC",
    text: "Disconnect the Power Umbilical-Power Supply cable.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 73,
    role: "AVC & PRC",
    text: "Connect the Umbilical Panel to the Vent Radax using 4 6-32 fasteners.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 74,
    role: "AVC",
    text: "Connect the Male Power Umbilical connector to the rocket.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 75,
    role: "AVC",
    text: "Connect the Male Power Umbilical harness to a DC power supply.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 76,
    role: "PRC",
    text: "Lubricate the male QC on the F/DOV with Krytox.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 77,
    role: "AEC & PRC",
    text: "Secure panels to radaxes excluding the panels covering the prop boards, ensure all vent lines are routed out of the panels and are covered loosely to prevent dust from entering the lines.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 78,
    role: "AEC & PRC",
    text: "ENSURE THAT THE MANUAL DUMP VALVE IS CLOSED.",
  }),
];
