import { ProcedureStep } from "@mrt/yamcs-effect";

export const basicMovVerificationSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Basic MOV Verification",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 41,
    role: "PRC",
    text: "Place 2 fingers on the MOV solenoid to feel for gate actuation.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 42,
    role: "CSH",
    name: "/FlightComputer/arm_recovery",
    comment: "Press the command stack button to set Recovery Arm.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 43,
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
        value: true,
        display: { row: "Drogue", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/drogue_armed_HW",
        operator: "eq",
        value: true,
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
        value: true,
        display: { row: "Main", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/main_armed_HW",
        operator: "eq",
        value: true,
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
    stepNumber: 44,
    role: "AVC",
    text: [
      "Confirm the LEDs on the FC-A Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off off",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      off  off   off on",
      "Confirm the LEDs on the FC-B Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off off",
      "  Channel  CON  GATE  EN  ARM",
      "  CH2      off  off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 45,
    role: "CSH",
    comment: "Insert and turn the key switch clockwise to set MOV to ARMED.",
    name: "/FlightComputer/mov_arming",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 46,
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
    stepNumber: 47,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 48,
    role: "CSH",
    name: "/FlightComputer/umbilical_to_battery",
    comment: "Press the command stack button to set Umbilical Low.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 49,
    role: "CSC",
    presentation: {
      type: "truthTable",
      columns: [{ id: "state", label: "State" }],
    },
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
    type: "command",
    stepNumber: 50,
    role: "CSC",
    comment: "Press the Launch button.",
    name: "/FlightComputer/launch",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 51,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   on    off off",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 52,
    role: "PRC",
    text: "Confirm that the MOV solenoid de-energizes after 5 seconds.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 53,
    role: "CSH",
    comment: "Turn the key switch counter clockwise to set MOV to DISARMED.",
    name: "/FlightComputer/mov_disarming",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 54,
    role: "CSH",
    text: "Remove the key from the key switch.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 55,
    role: "CSH",
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
        value: false,
        display: { row: "MOV", column: "logicalArm" },
      },
      {
        parameter: "/SystemA/Rocket/FlightComputer/mov_armed_electrical_HW",
        operator: "eq",
        value: false,
        display: { row: "MOV", column: "electricalArm" },
      },
    ],
    delay: 0,
    comment:
      "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 56,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  off   off on",
    ].join("\n"),
  }),
];
