import { ProcedureStep } from "@mrt/yamcs-effect";

export const basicMovVerificationSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Basic MOV Verification",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 35,
    role: "PRC",
    text: "Place 2 fingers on the MOV solenoid to feel for gate actuation.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 36,
    role: "CSH",
    comment: "Insert and turn the key switch clockwise to set MOV to ARMED.",
    name: "/FlightComputer/mov_arming",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 37,
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
    stepNumber: 38,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   off   off on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 39,
    role: "CSC",
    comment: "Press the Launch button.",
    name: "/FlightComputer/launch",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 40,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      on   on    on  on",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 41,
    role: "PRC",
    text: "Confirm that the MOV solenoid de-energizes after 5 seconds.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 42,
    role: "CSH",
    comment: "Turn the key switch counter clockwise to set MOV to DISARMED.",
    name: "/FlightComputer/mov_disarming",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 43,
    role: "CSH",
    text: "Remove the key from the key switch.",
  }),
  ProcedureStep.make({
    type: "verify",
    stepNumber: 44,
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
    stepNumber: 45,
    role: "AVC",
    text: [
      "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
      "  Channel  ARM  GATE  EN  CON",
      "  CH1      off  off   off on",
    ].join("\n"),
  }),
];
