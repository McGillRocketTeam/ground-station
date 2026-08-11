import { ProcedureStep } from "@mrt/yamcs-effect";

export const postRaiseTeamPictureSteps = [
  ProcedureStep.make({
    type: "note",
    text: "At this point, only required tower raising personnel and operators should be in the safety perimeter of the launch tower. All of them must be wearing yellow jackets, hard hats, safety shoes, and coated gloves.",
    color: "#FEBFBF",
  }),
  ProcedureStep.make({
    type: "note",
    text: "Proceed once the launch rail is raised.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 53,
    role: "PD",
    text: "Call over the RSO to confirm launch angle before tightening the anchoring.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 54,
    role: "All",
    text: "Take a quick group picture! Then, all non-essential launch pad personnel must leave the safety perimeter of the launch rail.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 55,
    role: "All",
    text: "All personnel except PD, OP1, OP2, OP3, OP4, OP5 exit the launch pad and head back to the ground station.",
  }),
];
