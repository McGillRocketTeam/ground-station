import { ProcedureStep } from "@mrt/yamcs-effect";

export const launchPadSetupSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Warning: The rocket contains black powder. Keep the nose cone pointed in a safe direction. Personnel should not stand in front of the nose cone.",
    color: "#FEBFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 1,
    role: "AD",
    text: "Designate an assembler from each subteam to pack any hardware or tools to be brought to the launch pad (into the pickup truck if necessary).",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 2,
    role: "AD",
    text: "Direct assembly team to transport the rocket to the flight safety tent.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 3,
    role: "PD",
    text: "Wait for flight approval. If time allows, verify the state of the launch pad in preparation for launch procedures (generator gas level, valve states, etc...).",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 4,
    role: "AD",
    text: "Receive flight approval.",
  }),
  ProcedureStep.make({
    type: "note",
    text: "If flight approval is not granted, return to the assembly tents to rectify the issue; Inform the pad and the ground station. Then restart these procedures.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 5,
    role: "AD",
    text: "Inform the ground station and the launch pad that flight approval has been granted.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 6,
    role: "AD",
    text: "Load the rocket onto the pickup truck. Wait for the range to open.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 7,
    role: "OP3",
    text: "Turn on the launch pad generator and the pad box. Make sure to switch on all the breakers in the pad box.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 8,
    role: "AD",
    text: "Drive the rocket to the launch pad. The whole team should come as well.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 9,
    role: "PD",
    text: "Go to tower raising final checklist and confirm that the rocket can be installed on the launch rail.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 10,
    role: "PD",
    text: "Direct the operators to transport the rocket from the pickup truck to the end of the launch rail.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 11,
    role: "PD",
    text: "Slowly guide the rocket onto the launch rail with the help of the operators. There are 2 rail buttons. Take care to not scratch the rocket sticker.",
  }),
];
