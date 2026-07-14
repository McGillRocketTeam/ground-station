import { ProcedureStep } from "@mrt/yamcs-effect";

export const goNoGoToTw3Steps = [
  ProcedureStep.make({
    type: "note",
    text: "End of simultaneous Procedures",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 71,
    role: "LD",
    text: "Announce Go/No-Go for propulsion system purge: _____",
  }),
  ProcedureStep.make({
    type: "note",
    text: 'If waiting for a salvo, to conserve battery life, turn off the propulsion controllers on the GUI with the "Prop Off" button. Turn off the flight computers by inserting the respective pull pins into Arming Board A. Undo these steps before proceeding.',
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 72,
    role: "PD",
    text: "Confirm Go/No-Go to Filling and Arming for Launch Procedures [TW3] on the launch pad side: _____",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 73,
    role: "LD",
    text: "Confirm Go/No-Go to Filling and Arming for Launch Procedures [TW3] on the ground station side: _____",
  }),
  ProcedureStep.make({
    type: "note",
    text: "If state is No-Go, move to the appropriate procedures to resolve the problem.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 74,
    role: "OP3",
    text: "If state is No-Go For Launch, ensure that the umbilical is connected to the Pad Box and disarm the SRAD Avionics system.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 75,
    role: "PD",
    text: "If state is Go For Launch, direct all non-essential personnel to leave the launch pad.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 76,
    role: "PD",
    text: "Perform an operator headcount. Number of people at the launch pad: _____ Expected: 6.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 77,
    role: "LD",
    text: "Perform a headcount of everyone at the ground station. Call for personnel to no longer move between competition locations. Number of people at the ground station: _____",
  }),
];
