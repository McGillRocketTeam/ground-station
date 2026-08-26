import { ProcedureStep } from "@mrt/yamcs-effect";

export const simultaneousOperationsSteps = [
  ProcedureStep.make({
    type: "note",
    text: "The following steps can be done simultaneously and are organized by LD/PD.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 14,
    role: "OP1",
    text: [
      "1. Securely fasten the rail stop.",
      "2. Remove protective padding from nose cone.",
      "3. Unbag rocket PRV and vent line.",
      "4. Remove the plug on the MOV closing port.",
      "5. Make sure rocket manual dump is closed.",
      "6. Confirm that all tower-side guywires are properly fastened.",
      "7. Stay by the rocket and wait for valve checks. Be ready to rotate the F/DOV if asked by fill system operators.",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 15,
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
    stepNumber: 16,
    role: "OP3",
    text: [
      "1. Turn on pad box and flip on all breakers",
      "2. Setup up both e-mounts, ensuring they are properly aligned.",
      "3. Connect power umbilical on the rocket side. Make sure the cable isn't tangled with the radax or rail guide. Make sure to turn it on.",
      "4. Verify all camera positions in coordination with LD",
      "5. Check continuity of all wiring",
      "6. Stand by the padbox for ignitor circuit checks",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 17,
    role: "OP5",
    text: [
      "1. Perform manual dump line pull tests. Do one valve at a time and then close both V-21 and V-24 after the test.",
      "2. Check CGA and flex tubing to gas bottle connections. Make sure filter is oriented downward.",
      "3. Stay by the panel side valve checks",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 18,
    role: "PD",
    text: "Double check the alignment of both e-mounts and that indicated markings align",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 19,
    role: "PD to LD",
    text: "Inform we are ready to proceed with ignition checks once OP3 is done with their tasks.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 20,
    role: "PD to LD",
    text: "Confirm that the pad manual dump valves [V-21], [V-24] and the rocket manual dump [V-25] are fully closed.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 21,
    role: "PD",
    text: "Give the arming key to OP3, who arms the pad box after a countdown from 3 over radio.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 22,
    role: "LD",
    text: "Give the testing arming key to CS",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 23,
    role: "CS",
    name: "/FlightComputer/mov_arming",
    comment:
      "Arm the propulsion system using the testing arming key after a countdown from 3 over the radio.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 24,
    role: "OP3",
    text: "Probe the WAGO connectors connected to the igniter leads with a multimeter set to measure voltage and confirm it over the radio.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 25,
    role: "CS",
    name: "/EGSE/Pad/LabJackT7/write_digital_pin",
    arguments: [
      { name: "pin_number", value: 21 },
      { name: "pin_state", value: "HIGH" },
    ],
    comment: "Send a signal for IGN- after a countdown from 3 over radio.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 26,
    role: "OP3",
    text: "Confirm to PD that voltmeter is reading 0V",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 27,
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
    stepNumber: 28,
    role: "OP3",
    text: "Confirm to PD that the multimeter is reading 24V.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 29,
    role: "CS",
    commands: [
      {
        name: "/EGSE/Pad/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 21 },
          { name: "pin_state", value: "LOW" },
        ],
      },
      {
        name: "/EGSE/Pad/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 20 },
          { name: "pin_state", value: "LOW" },
        ],
      },
    ],
    comment: "Set both IGN- and IGN+ to low",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 30,
    role: "OP3",
    text: "Confirm to PD that the multimeter is reading 0V.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 31,
    role: "CS",
    name: "/FlightComputer/mov_disarming",
    comment:
      "Disarm the propulsion system by removing the testing arming key. Give the arming key back to LD",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 32,
    role: "OP4",
    text: "Disarm the pad box using the arming key then give the key back to PD.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 33,
    role: "LD to PD",
    text: "Inform that ignition checks are complete",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 34,
    role: "LD to PD",
    text: "Announce the start of fill panel valve actuation tests",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 35,
    role: "LD",
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
      "Energize and De-Energize the following valves, confirming actuation using Cameras and the GUI.\nFill Valve V-22 NC:\nDump Valve V-23 NO:",
  }),
];
