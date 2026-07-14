import { ProcedureStep } from "@mrt/yamcs-effect";

export const simultaneousOperationsSteps = [
  ProcedureStep.make({
    type: "note",
    text: "The following steps can be done simultaneously and are organized by LD/PD.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 12,
    role: "OP1",
    text: [
      "1. Securely fasten the rail stop.",
      "2. Remove protective padding from nose cone",
      "3. Unbag rocket PRV and vent line",
      "4. Make sure rocket manual dump is closed",
      "5. Confirm that all tower-side guywires are properly fastened.",
      "6. Stay by the rocket and wait for valve checks. Be ready to rotate the FDOV if asked by fill system operators.",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 13,
    role: "OP2 & OP4",
    text: [
      "1. Begin work on fill arm assembly",
      "2. Lubricate both male and female QC",
      "3. Perform a pull test on fill line once connected",
      "4. Thoroughly go through all internal checks",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 14,
    role: "OP3",
    text: [
      "1. Turn on pad box and flip on all breakers",
      "2. Setup up e-mount, adjusting its position.",
      "3. Connect power umbilical on the rocket side. Make sure the cable isn't tangled with the radax or rail guide.",
      "4. Verify all camera positions in coordination with LD",
      "5. Check continuity of all wiring",
      "6. Stand by the padbox for ignitor circuit checks",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 15,
    role: "OP5",
    text: [
      "1. Perform manual dump line pull tests. Do one valve at a time and then close both V-21 and V-24 after the test.",
      "2. Check CGA and flex tubing to gas bottle connections. Make sure filter is oriented downward.",
      "3. Stay by the panel side valve checks",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 16,
    role: "PD to LD",
    text: "Inform we are ready to proceed with valve checks once OP1, OP3, and OP5 are done with their tasks.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 17,
    role: "PD to LD",
    text: "Confirm that the pad manual dump valves [V-21], [V-24] and the rocket manual dump [V-25] are fully closed.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 18,
    role: "LD to PD",
    text: "Announce the start of valve actuation tests",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 19,
    role: "CS",
    commands: [
      {
        name: "/EGSE/Pad/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 0 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
      {
        name: "/EGSE/Pad/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 0 },
          { name: "pin_state", value: "LOW" },
        ],
      },
    ],
    comment:
      "Energize to open and de-energize to close the panel fill valve [V-22] after countdown from 3 over radio. Confirm actuation using cameras and operators.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 20,
    role: "CS to PD",
    commands: [
      {
        name: "/EGSE/Pad/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 1 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
      {
        name: "/EGSE/Pad/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 1 },
          { name: "pin_state", value: "LOW" },
        ],
      },
    ],
    comment:
      "Energize to close and de-energize to open the panel dump valve [V-23] after countdown from 3 over radio. Confirm actuation using cameras and operators.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 21,
    role: "CS to PD",
    commands: [
      { name: "/FlightComputer/vent_valve_energize" },
      { name: "/FlightComputer/vent_valve_de-energize" },
    ],
    comment: "Energize and de-energize the vent valve [V-12] after countdown from 3 over radio.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 22,
    role: "CS to PD",
    commands: [
      { name: "/FlightComputer/fdov_energize" },
      { name: "/FlightComputer/fdov_de-energize" },
    ],
    comment:
      "Energize and de-energize the FDOV pilot [V-31] after countdown from 3 over radio: Confirm that the Fill-Dump Oxidizer Valve is energized by hearing a 'click' sound from its pilot and receiving an acknowledgment. The FDOV valve [V-11] should not actuate at this point.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 23,
    role: "CS",
    name: "",
    comment: "Arm the control box with the testing arming key.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 24,
    role: "CS",
    name: "",
    comment: "Confirm that there is continuity of the Main Oxidizer Valve MOV [V-13] on the GUI.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 25,
    role: "CS to PD",
    name: "/FlightComputer/launch",
    comment:
      "Press the \"Launch\" button on the control box after countdown from 3 over radio: Confirm that the Main Oxidizer Valve MOV is energized by hearing a 'click' sound from its pilot and receiving an acknowledgment.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 26,
    role: "CS",
    name: "/FlightComputer/reset_av",
    comment:
      'Press the "Reset FC" button on the GUI: confirm that the ACK for the reset command is received.',
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 27,
    role: "CS",
    name: "/FlightComputer/propulsion_on",
    comment: 'Energize the propulsion controllers by pressing the "Prop On" button on the GUI.',
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 28,
    role: "CS",
    name: "/FlightComputer/emergency_stop",
    comment:
      'Release the "Launch" button on the control box and disarm the control box with the key.',
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 29,
    role: "PD",
    text: "Give the arming key to OP1, who arms the pad box after a countdown from 3 over radio.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 30,
    role: "LD",
    text: "Give the testing arming key to CS",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 31,
    role: "CS",
    name: "/FlightComputer/mov_arming",
    comment: "Arm the propulsion system using the testing arming key.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 32,
    role: "OP3",
    text: "Probe the WAGO connectors connected to the igniter leads with a multimeter set to measure voltage.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 33,
    role: "CS",
    name: "",
    comment: "Send a signal for IGN- after a countdown from 3 over radio.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 34,
    role: "OP3",
    text: "Confirm to PD that voltmeter is reading 0V",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 35,
    role: "CS",
    name: "/EGSE/Pad/LabJackT7/write_digital_pin",
    arguments: [
      { name: "pin_number", value: 20 },
      { name: "pin_state", value: "HIGH" },
    ],
    comment: "Send a signal for IGN+ after a countdown from 3 over radio.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 36,
    role: "OP3",
    text: "Confirm to PD that the multimeter is reading 24V.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 37,
    role: "CS",
    name: "",
    comment: "Set both IGN- and IGN+ to low",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 38,
    role: "OP3",
    text: "Confirm to PD that the multimeter is reading 0V.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 39,
    role: "CS",
    name: "/FlightComputer/mov_disarming",
    comment:
      "Disarm the propulsion system by removing the testing arming key. Give the arming key back to LD",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 40,
    role: "OP4",
    text: "Disarm the pad box using the arming key then give the key back to PD.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 41,
    role: "LD to PD",
    text: "Inform that valve checks are complete",
  }),
];
