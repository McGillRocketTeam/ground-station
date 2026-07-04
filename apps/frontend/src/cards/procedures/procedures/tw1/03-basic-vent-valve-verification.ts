import { ProcedureStep } from "@mrt/yamcs-effect";

export const basicVentValveVerificationSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Basic Vent Valve Verification",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 28,
    role: "PRC",
    text: "Place 2 fingers on the vent valve to feel for gate actuation.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 29,
    role: "CSH",
    name: "/FlightComputer/vent_valve_energize",
    comment: "Set the Vent Valve switch to ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 30,
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
        display: { row: "Vent Valve", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedGate_HW",
        operator: "eq",
        value: true,
        display: { row: "Vent Valve", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "Vent Valve", column: "energizeCurrent" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 31,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   on    on  on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 32,
    role: "CSH",
    name: "/FlightComputer/vent_valve_de-energize",
    comment: "Set the Vent Valve switch to DE-ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 33,
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
        value: false,
        display: { row: "Vent Valve", column: "logicalEnergized" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedGate_HW",
        operator: "eq",
        value: false,
        display: { row: "Vent Valve", column: "energizeGate" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_energizedCurrent_HW",
        operator: "eq",
        value: false,
        display: { row: "Vent Valve", column: "energizeCurrent" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 34,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
];
