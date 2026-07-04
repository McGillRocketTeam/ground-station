import { ProcedureStep } from "@mrt/yamcs-effect";

export const disconnectionTestingSteps = [
  ProcedureStep.make({
    type: "note",
    text: "End of simultaneous operations",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 42,
    role: "PD",
    text: "Go to Tower Raising Procedures [Pad3]",
  }),
  ProcedureStep.make({
    type: "note",
    text: "At this point, only required tower raising personnel and operators should be in the safety perimeter of the launch tower. All of them must be wearing yellow jackets, hard hats, safety shoes, and coated gloves.",
    color: "#FEBFBF",
  }),
  ProcedureStep.make({
    type: "note",
    text: "Proceed once the launch rail is raised.\nLAUNCH DIRECTOR : if disconnection testing is being skipped, proceed to step 59",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 43,
    role: "PD to LD",
    text: "Inform LD that the pad is ready for disconnection testing",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 44,
    role: "PD",
    text: "Check that the breakers required for disconnection and retraction are on.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 45,
    role: "CS",
    commands: [
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 5 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 7 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
    ],
    comment:
      "Actuate the DIS linear actuator to retract by energizing DIS Actuator Polarity and DIS Actuator Power on the control box, broadcasting a countdown from 3 for both.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 46,
    role: "PD to LD",
    text: "Confirm successful disengagement.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 47,
    role: "CS",
    commands: [
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 4 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 6 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
    ],
    comment:
      "Actuate the RET linear actuator to retract by energizing RET Actuator Polarity and RET Actuator Power on the control box, broadcasting a countdown from 3 for both.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 48,
    role: "PD to LD",
    text: "Confirm successful retraction.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 49,
    role: "CS",
    commands: [
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 7 },
          { name: "pin_state", value: "LOW" },
        ],
      },
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 6 },
          { name: "pin_state", value: "LOW" },
        ],
      },
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 5 },
          { name: "pin_state", value: "LOW" },
        ],
      },
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 4 },
          { name: "pin_state", value: "LOW" },
        ],
      },
    ],
    comment:
      "De-energize Actuators Power (both DIS and RET) and Actuators Polarity (both DIS and RET) on the control box.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 50,
    role: "CS",
    commands: [
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 4 },
          { name: "pin_state", value: "LOW" },
        ],
      },
      {
        name: "/LabJackT7/write_digital_pin",
        arguments: [
          { name: "pin_number", value: 6 },
          { name: "pin_state", value: "HIGH" },
        ],
      },
    ],
    comment:
      "Actuate RET linear actuator to extend by energizing RET Actuator Power on the control box, broadcasting a countdown from 3.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 51,
    role: "PD",
    text: "Confirm RET actuator has extended to full stroke.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 52,
    role: "PD",
    text: "Go to Tower Lowering Procedures [Pad3]",
  }),
  ProcedureStep.make({
    type: "note",
    text: "Proceed once the launch rail is lowered.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 53,
    role: "OP2 & OP4",
    text: "Reconnect the fill disconnection system to the rocket, following disconnect assembly procedures [Pad4].",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 54,
    role: "LD",
    text: "On the go of OP2, extend the DIS linear actuator by energizing DIS actuator power.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 55,
    role: "OP2 & OP4",
    text: "Perform a pull test on the fill line to ensure the quick connect is properly connected.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 56,
    role: "PD & OP4",
    text: "Once proper alignment of the fill arm is confirmed, perform a second pull test on the fill line to ensure the quick connect is properly connected.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 57,
    role: "OP3",
    text: "Confirm that all connections from padbox to launch pad components are continuous.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 58,
    role: "PD",
    text: "Go to Tower Raising Procedures [Pad3]",
  }),
];
