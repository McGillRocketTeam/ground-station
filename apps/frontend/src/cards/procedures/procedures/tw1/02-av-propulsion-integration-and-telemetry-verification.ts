import { ProcedureStep } from "@mrt/yamcs-effect";

export const avPropulsionIntegrationAndTelemetryVerificationSteps = [
  ProcedureStep.make({
    type: "note",
    text: "AV-Propulsion Integration & Telemetry Verification",
    color: "#FFBF80",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 21,
    role: "CSH",
    name: "/FlightComputer/propulsion_on",
    comment: "Press the command stack button to set Propulsion On.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 22,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [
        { id: "logicalArm", label: "armed_SW" },
        { id: "electricalArm", label: "armed_HW" },
        { id: "continuity", label: "continuity_HW" },
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
    stepNumber: 23,
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
    type: "verify",
    stepNumber: 24,
    role: "CSC",
    comment: "Verify that the Tank Pressure reading is within 0.0 to 20.0 PSI.",
    delay: 0,
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/tank_pressure",
        operator: "gte",
        value: 0,
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/tank_pressure",
        operator: "lte",
        value: 20,
      },
    ],
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 25,
    role: "CSC",
    comment: "Verify that the Vent Temperature reading is within 12.0 to 33.0 C.",
    delay: 0,
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_temp",
        operator: "gte",
        value: 12,
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/vent_temp",
        operator: "lte",
        value: 33,
      },
    ],
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 26,
    role: "CSC",
    comment: "Verify that the Combustion Chamber Pressure reading is within 0.0 to 20.0 PSI.",
    delay: 0,
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/cc_pressure",
        operator: "gte",
        value: 0,
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/cc_pressure",
        operator: "lte",
        value: 20,
      },
    ],
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 27,
    role: "CSC",
    comment: "Verify that the Tank Temperature reading is within 12.0 to 33.0 C.",
    delay: 0,
    condition: [
      {
        parameter: "/SystemA/Rocket/FlightComputer/tank_temp",
        operator: "gte",
        value: 12,
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/tank_temp",
        operator: "lte",
        value: 33,
      },
    ],
  }),
];
