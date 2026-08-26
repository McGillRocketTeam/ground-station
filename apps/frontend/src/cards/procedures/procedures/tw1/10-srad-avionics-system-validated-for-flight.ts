import { ProcedureStep } from "@mrt/yamcs-effect";

export const sradAvionicsSystemValidatedForFlightSteps = [
  ProcedureStep.make({
    type: "note",
    text: "The SRAD avionics system is validated for flight.",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 31,
    role: "AEC & AVC",
    text: "Slide GFRP over AV bay. Be careful of the AV Bay antennas, MagSW Mounts, and recovery and payload wiring.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 32,
    role: "AEC",
    text: 'Fasten GFRP to Vent Radax 8 #10-32 3/4" fasteners.',
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 33,
    role: "AEC",
    text: "Torque all GFRP fasteners to spec.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 34,
    role: "PRC",
    text: "Verify the MOV is closed.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 35,
    role: "AEC",
    text: "Verify panels have been secured.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 36,
    role: "PRC & AEC",
    text: "Wrap tank wires in extra sticker section for aesthetic purposes (omittable)",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 37,
    role: "AEC & PRC",
    text: "Attach remaining 2 radax panels using 8 #8-32 fasteners.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 38,
    role: "AEC",
    text: "Measure and mark the rocket's mass and center of gravity.",
  }),
  ProcedureStep.make({
    type: "note",
    text: "TW1 has now been completed",
    color: "#FFF798",
  }),
];
