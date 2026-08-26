import { ProcedureStep } from "@mrt/yamcs-effect";

export const basicFdovVerificationSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Basic F/DOV Verification",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 57,
    role: "PRC",
    text: "Place 2 fingers on the F/DOV solenoid to feel for gate actuation.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 58,
    role: "CSH",
    name: "/FlightComputer/fdov_energize",
    comment: "Set the F/DOV switch to ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 59,
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
    stepNumber: 60,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      off  on    off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 61,
    role: "CSH",
    name: "/FlightComputer/fdov_de-energize",
    comment: "Set the F/DOV switch to DE-ENERGIZED.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 62,
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
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 63,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      on   off   off on",
    ].join("\n"),
  }),
];
