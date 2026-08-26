import { ProcedureStep } from "@mrt/yamcs-effect";

export const goNoGoToTw3Steps = [
  ProcedureStep.make({ type: "note", text: "End of simultaneous Procedures", color: "#FFDFBF" }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 80,
    role: "LD",
    text: "Announce Go/No-Go for propulsion system purge: _____",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 81,
    role: "PD",
    text: "Confirm Go/No-Go to Filling and Arming for Launch Procedures [TW3] on the launch pad side: _____",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 82,
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
    stepNumber: 83,
    role: "OP3",
    text: "If state is No-Go For Launch, ensure that the umbilical is connected to the Pad Box and disarm the SRAD and COTS Avionics system.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 84,
    role: "PD",
    text: "If state is Go For Launch, direct all non-essential personnel to leave the launch pad.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 85,
    role: "PD",
    text: "Perform an operator headcount. Number of people at the launch pad: _____ Expected: 6.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 86,
    role: "LD",
    text: "Perform a headcount of everyone at the ground station. Call for personnel to no longer move between competition locations. Number of people at the ground station: _____",
  }),
];
