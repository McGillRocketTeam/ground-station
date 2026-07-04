import { ProcedureStep } from "@mrt/yamcs-effect";

export const avPropSubAssemblyCompleteSteps = [
  ProcedureStep.make({
    type: "note",
    text: "The AV-Prop sub-assembly is complete.",
    color: "#FFF798",
  }),
];
