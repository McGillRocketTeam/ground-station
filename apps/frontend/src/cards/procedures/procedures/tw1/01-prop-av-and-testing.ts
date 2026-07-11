import { ProcedureStep } from "@mrt/yamcs-effect";

export const propAvAndTestingSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Prop/AV and Testing Procedures",
    color: "#B892B6",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 1,
    role: "AES & AVC",
    text: "Hold and align the AV Bay so that the backplane is closest to the rail.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 2,
    role: "AES & AVC",
    text: "AVC keeps holding the AV bay while AEC screws in the 6-32 fasteners through the AV plate into the vent radax.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 3,
    role: "AVC",
    text: "Screw Prop Top into the Prop Top mount using 4 4-40 fasteners.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 4,
    role: "AVC & PRC",
    text: "Attach the Tank PT wires to a SE ModPT DB PCB. Be careful of wire polarity: black goes to the -, red goes to 5 V, green goes to PT.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 5,
    role: "AVC",
    text: "Attach the ModPT SE DB to Prop Top.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 6,
    role: "AVC & PRC",
    text: "Attach the Vent TC to Prop Top. Be careful of wire polarity: red/blue goes to the terminal block pin closest to the TC label, yellow/brown goes to the terminal block pin closest to the corner of the PCB.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 7,
    role: "AVC & PRC",
    text: "Attach the vent valve wires to the valve terminal block on Prop Top. There is no wire polarity.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 8,
    role: "AVC & PRC",
    text: "Screw the CC PT wires into the ModPT DB on prop bottom. Be careful of wire polarity.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 9,
    role: "AVC & PRC",
    text: "Screw the Tank TC wires into Prop Bottom. Be careful of wire polarity: red goes to +, black goes to -.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 10,
    role: "AVC & PRC",
    text: "Screw the F/DOV wires into the F/DOV terminal block on Prop Bottom. The F/DOV terminal block is the big 2-pin terminal block closest to the top right corner of the PCB. There is no wire polarity.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 11,
    role: "AVC & PRC",
    text: "Screw the MOV wires into the MOV terminal block on Prop Bottom. The MOV terminal block is the terminal big 2-pin terminal block closest to the Prop Top-to-Prop Bottom wire harness connector. There is no wire polarity.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 12,
    role: "AVC",
    text: "Slide Prop Bottom into the Prop Bottom mount.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 13,
    role: "AVC",
    text: "Attach the Prop Top to Backplane wiring harness.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 14,
    role: "AVC",
    text: "Attach the Prop Top to Prop Bottom wiring harness.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 15,
    role: "AES & AVC",
    text: "Check that prop valve and sensor wires are tucked inside the vent and intertank radaxes, and that the Prop Top to Prop Bottom harness is correctly placed to fit through the panels.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 16,
    role: "AVC",
    text: "Secure the Prop Top to Prop Bottom Harness to the tank using Aluminum tape.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 17,
    role: "AVC",
    text: "Connect the Backplane-Power Supply harness.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 18,
    role: "AES & AVC",
    text: "Check that the Backplane-Power Supply harness is correctly placed to fit through the Umbilical Panel.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 19,
    role: "AVC",
    text: "Set the DC Power supply to 25.2V at 2.0A, and turn the output on.",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 20,
    role: "AVC",
    text: "Arm SRAD Avionics.",
  }),
];
