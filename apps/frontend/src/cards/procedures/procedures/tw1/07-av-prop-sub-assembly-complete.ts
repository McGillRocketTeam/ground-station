import { ProcedureStep } from "@mrt/yamcs-effect";

export const avPropSubAssemblyCompleteSteps = [
  ProcedureStep.make({
    type: "text",
    stepNumber: 87,
    role: "AVC",
    text: "Turn off the Power Supply.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 88,
    role: "AVC",
    text: "Disconnect the Power Umbilical-Power Supply cable.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 89,
    role: "AVC & AEC",
    text: "Connect the Umbillical Connector to the Umbillical Connector panel using 4 4-40 fasteners.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 90,
    role: "AVC & PRC",
    text: "Connect the Umbilical Panel to the Vent Radax using 4 8-32 fasteners.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 91,
    role: "AVC",
    text: "Connect the Male Power Umbilical connector to the rocket.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 92,
    role: "AVC",
    text: "Connect the Male Power Umbilical harness to a DC power supply.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 93,
    role: "AVC & AEC",
    text: "Fully cover Prop Top with tape and the static bag.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 94,
    role: "AVC & AEC",
    text: "Fully cover Prop Bottom with tape and the static bag.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 95,
    role: "AEC & PRC",
    text: "Perform a pull test on the manual dump valve then close it. ENSURE THAT THE MANUAL DUMP VALVE IS FULLY CLOSED.\nUNSPOOL DUMP LINE AND FEED THROUGH TRAPDOOR",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 96,
    role: "PRC",
    text: "Remove the cap on the MOV closing port and on the vent valve.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 97,
    role: "AEC & PRC",
    text: "Secure panels to radaxes excluding the panels covering the prop boards, ensure all vent lines are routed out of the panels and are covered loosely to prevent dust from entering the lines.",
  }),
  ProcedureStep.make({
    type: "note",
    text: "The AV-Prop sub-assembly is complete.",
    color: "#FFF798",
  }),
];
