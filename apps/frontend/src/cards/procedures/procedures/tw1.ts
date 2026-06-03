import { ProcedureStack, ProcedureStep } from "@mrt/yamcs-effect";

export const TW1 = ProcedureStack.make({
  steps: [
    ProcedureStep.make({
      type: "note",
      text: "AV-Propulsion Integration & Telemetry Verification",
      color: "#FFBF80",
    }),
    ProcedureStep.make({
      type: "command",
      stepNumber: 18,
      role: "CSH",
      name: "/FlightComputer/reset_av",
      comment: "Press the command stack button to Reset AV.",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 19,
      role: "AVC",
      text: "Confirm FC-A reboots. \n Confirm FC-B reboots.",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 20,
      role: "CSC",
      text: "Confirm ACK for Reset AV",
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
          { id: "logicalArm", label: "Logical ARM" },
          { id: "electricalArm", label: "Electrical ARM" },
          { id: "continuity", label: "Continuity" },
        ],
      },
      condition: [
        {
          parameter: "/Propulsion/FDOV/logical_arm",
          operator: "eq",
          value: true,
          display: { row: "F/DOV", column: "logicalArm" },
        },
        {
          parameter: "/Propulsion/FDOV/electrical_arm",
          operator: "eq",
          value: true,
          display: { row: "F/DOV", column: "electricalArm" },
        },
        {
          parameter: "/Propulsion/FDOV/continuity",
          operator: "eq",
          value: false,
          display: { row: "F/DOV", column: "continuity" },
        },
        {
          parameter: "/Propulsion/VentValve/logical_arm",
          operator: "eq",
          value: true,
          display: { row: "Vent Valve", column: "logicalArm" },
        },
        {
          parameter: "/Propulsion/VentValve/electrical_arm",
          operator: "eq",
          value: true,
          display: { row: "Vent Valve", column: "electricalArm" },
        },
        {
          parameter: "/Propulsion/VentValve/continuity",
          operator: "eq",
          value: false,
          display: { row: "Vent Valve", column: "continuity" },
        },
        {
          parameter: "/Propulsion/MOV/logical_arm",
          operator: "eq",
          value: false,
          display: { row: "MOV", column: "logicalArm" },
        },
        {
          parameter: "/Propulsion/MOV/electrical_arm",
          operator: "eq",
          value: false,
          display: { row: "MOV", column: "electricalArm" },
        },
        {
          parameter: "/Propulsion/MOV/continuity",
          operator: "eq",
          value: false,
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
        "  Channel  ARM  CON  GATE  EN",
        "  CH1      on   off  off   off",
        "  CH2      off  off  off   off",
        "Confirm the LEDs on the Prop Top Energize Daughter Board are as follows:",
        "  Channel  ARM  CON  GATE  EN",
        "  CH1      on   off  off   off",
      ].join("\n"),
    }),
    ProcedureStep.make({
      type: "verify",
      stepNumber: 24,
      role: "CSC",
      comment: "Verify that the Tank Pressure reading is within 0.0 to 20.0 PSI",
      delay: 0,
      condition: [
        {
          parameter: "/Propulsion/TankPressure",
          operator: "gte",
          value: 0,
        },
        {
          parameter: "/Propulsion/TankPressure",
          operator: "lte",
          value: 20,
        },
      ],
    }),
    ProcedureStep.make({
      type: "verify",
      stepNumber: 25,
      role: "CSC",
      comment: "Verify that the Vent Temperature reading is within 12.0 to 30.0 C",
      delay: 0,
      condition: [
        {
          parameter: "/Propulsion/VentTemperature",
          operator: "gte",
          value: 12,
        },
        {
          parameter: "/Propulsion/VentTemperature",
          operator: "lte",
          value: 30,
        },
      ],
    }),
    ProcedureStep.make({
      type: "verify",
      stepNumber: 26,
      role: "CSC",
      comment: "Verify that the Combustion Chamber Pressure reading is within 0.0 to 0.0 Units",
      delay: 0,
      condition: [
        {
          parameter: "/Propulsion/CombustionChamberPressure",
          operator: "gte",
          value: 0,
        },
        {
          parameter: "/Propulsion/CombustionChamberPressure",
          operator: "lte",
          value: 0,
        },
      ],
    }),
    ProcedureStep.make({
      type: "verify",
      stepNumber: 27,
      role: "CSC",
      comment: "Verify that the Tank Temperature reading is within 0.0 to 0.0 Units",
      delay: 0,
      condition: [
        {
          parameter: "/Propulsion/TankTemperature",
          operator: "gte",
          value: 0,
        },
        {
          parameter: "/Propulsion/TankTemperature",
          operator: "lte",
          value: 0,
        },
      ],
    }),
    ProcedureStep.make({
      type: "command",
      stepNumber: 28,
      role: "CSH",
      name: "/FlightComputer/reset_prop_boards_valve_state",
      comment: "Press the command stack button to Reset Propulsion Valve States.",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 29,
      role: "CSC",
      text: "Completion ACK Received.",
    }),
    ProcedureStep.make({
      type: "note",
      text: "Basic MOV Verification",
      color: "#FFF798",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 30,
      role: "PRC",
      text: "Place 2 fingers corresponding valves to feel for gate actuation.",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 31,
      role: "CSH",
      text: "Insert and turn the key switch clockwise to switch MOV to ARMED.",
    }),
    ProcedureStep.make({
      type: "verify",
      stepNumber: 32,
      role: "CSC",
      presentation: {
        type: "truthTable",
        columns: [
          { id: "logicalArm", label: "Logical ARM" },
          { id: "electricalArm", label: "Electrical ARM" },
        ],
      },
      condition: [
        {
          parameter: "/Propulsion/MOV/logical_arm",
          operator: "eq",
          value: true,
          display: { row: "MOV", column: "logicalArm" },
        },
        {
          parameter: "/Propulsion/MOV/electrical_arm",
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
      type: "command",
      stepNumber: 33,
      role: "CSC",
      name: "/FlightComputer/launch",
      comment: "Send the LAUNCH command using the GUI.",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 34,
      role: "AVC",
      text: [
        "Confirm the LEDs on the Prop Bottom Energize Daughter Board are as follows:",
        "  Channel  ARM  CON  GATE  EN",
        "  CH1      on   off  off   off",
      ].join("\n"),
    }),
    ProcedureStep.make({
      type: "command",
      stepNumber: 35,
      role: "CSH",
      name: "/FlightComputer/mov_disarming",
      comment: "Turn the key switch counter clockwise to switch MOV to DISARMED.",
    }),
    ProcedureStep.make({
      type: "text",
      stepNumber: 36,
      role: "CSH",
      text: "Remove the key from the key switch.",
    }),
    ProcedureStep.make({
      type: "verify",
      stepNumber: 32,
      role: "CSC",
      presentation: {
        type: "truthTable",
        columns: [
          { id: "logicalArm", label: "Logical ARM" },
          { id: "electricalArm", label: "Electrical ARM" },
        ],
      },
      condition: [
        {
          parameter: "/Propulsion/MOV/logical_arm",
          operator: "eq",
          value: false,
          display: { row: "MOV", column: "logicalArm" },
        },
        {
          parameter: "/Propulsion/MOV/electrical_arm",
          operator: "eq",
          value: false,
          display: { row: "MOV", column: "electricalArm" },
        },
      ],
      delay: 0,
      comment:
        "Confirm that the completion ACK is received.\nConfirm the valve states are as follows:",
    }),
  ],
});
