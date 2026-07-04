import { ProcedureStep } from "@mrt/yamcs-effect";

export const finalRocketAssemblyProcedureSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Final Rocket Assembly Procedures.",
    color: "#A3C293",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 1,
    role: "AEC & EJC",
    text: "Slide the nose cone over the drogue plate and coupler, secure with 6 #6-32 shear pins",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 2,
    role: "AVC",
    text: "Attach the Payload Harness between the payload Adapter PCB & the Backplane PCB.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 3,
    role: "AVC",
    text: "Attach both CM4 XT-30 Connectors.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 4,
    role: "AVC",
    text: "Attach both CD4 XT-30 Connectors.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 5,
    role: "AVC",
    text: "Arm COTS avionics.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 6,
    role: "AVC",
    text: "Confirm Blue Raven Electrical Continuity by listening for two beeps, and seeing two green LED flashes.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 7,
    role: "AVC",
    text: "Verify Blue Raven is properly configured using Blue Raven Mobile App.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 8,
    role: "AVC",
    text: "Disarm COTS avionics.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 9,
    role: "AVC",
    text: "Switch the Featherweight GPS tracker power switch to on.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 10,
    role: "CSC",
    text: "Verify the reception of packets on the Featherweight GPS Tracker ground station using the Blue Raven Mobile app.",
  }),
  ProcedureStep.make({
    type: "note",
    text: "The COTS avionics system is validated for flight.",
    color: "#FFF798",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 11,
    role: "AVC",
    text: "Attach both SM4 XT-30 Connectors.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 12,
    role: "AVC",
    text: "Attach both SD4 XT-30 Connectors.",
  }),
];
