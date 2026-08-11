import { ProcedureStep } from "@mrt/yamcs-effect";

const textStep = (stepNumber: number, role: string, text: string) =>
  ProcedureStep.make({ type: "text", stepNumber, role, text });

export const propAvAndTestingSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Prop/AV and Testing Procedures",
    color: "#B892B6",
  }),
  textStep(
    1,
    "AVC & PRC",
    "Attach the Tank PT wires to a SE ModPT DB PCB, and ensure wires are tucked inside the radax. Be careful of wire polarity: black goes to the -, red goes to 5 V, green goes to PT.",
  ),
  textStep(2, "AVC", "Attach the ModPT SE DB to Prop Top."),
  textStep(
    3,
    "AVC & PRC",
    "Attach the Vent TC to Prop Top, and ensure the wires are tucked inside the radax. Be careful of wire polarity: red goes to the terminal block pin closest to the TC silkscreen label, yellow goes to the terminal block pin closest to the corner of the PCB.",
  ),
  textStep(
    4,
    "PRC",
    "Tape the vent line thermocouple to the vent line exhaust, ensuring that the wire is in the tube.",
  ),
  textStep(5, "AVC", "Screw Prop Top into the Prop Top mount using 4 4-40 fasteners."),
  textStep(
    6,
    "AVC & AEC",
    "Partially cover Prop Top with a static bag and tape. Ensure that the LEDs are still visible",
  ),
  textStep(
    7,
    "AVC & PRC",
    "Attach the vent valve wires to the valve terminal block on Prop Top, and ensure the wires are tucked inside the radax. There is no wire polarity.",
  ),
  textStep(
    8,
    "AES & AVC",
    "Hold and align the AV Bay so that the backplane is closest to the rail.",
  ),
  textStep(
    9,
    "AES & AVC",
    "AVC keeps holding the AV bay while AEC screws in the 6-32 fasteners through the AV plate into the vent radax.",
  ),
  textStep(
    10,
    "AVC & PRC",
    "Screw the CC PT wires into the SE ModPT DB on prop bottom, and ensure wires are tucked inside the radax. Be careful of wire polarity.",
  ),
  textStep(
    11,
    "AVC & PRC",
    "Screw the Tank TC wires into Prop Bottom, and ensure the wires are tucked inside the radax. Be careful of wire polarity: red goes to +, black goes to -.",
  ),
  textStep(
    12,
    "AVC & PRC",
    "Screw the F/DOV wires into the F/DOV terminal block on Prop Bottom, and ensure the wires are tucked inside the radax. The F/DOV terminal block is the big 2-pin terminal block closest to the top right corner of the PCB. There is no wire polarity.",
  ),
  textStep(
    13,
    "AVC & PRC",
    "Screw the MOV wires into the MOV terminal block on Prop Bottom, and ensure the wires are tucked inside the radax. The MOV terminal block is the terminal big 2-pin terminal block closest to the Prop Top-to-Prop Bottom wire harness connector. There is no wire polarity.",
  ),
  textStep(14, "AVC & PRC", "Slide Prop Bottom into the Prop Bottom mount."),
  textStep(
    15,
    "AVC & AEC",
    "Partially cover Prop Bottom with a static bag and tape. Ensure that the LEDs are still visible",
  ),
  textStep(16, "AVC", "Attach the Prop Top to Backplane wiring harness."),
  textStep(17, "AVC", "Attach the Prop Top to Prop Bottom wiring harness."),
  textStep(
    18,
    "AES & AVC",
    "Check that prop valve and sensor wires are tucked inside the vent and intertank radaxes, and that the Prop Top to Prop Bottom harness is correctly placed to fit through the panels.",
  ),
  textStep(
    19,
    "AVC",
    "Secure the Prop Top to Prop Bottom Harness to the tank using Aluminum tape.",
  ),
  textStep(20, "AVC", "Connect the Backplane-Power Supply harness."),
  textStep(
    21,
    "AES & AVC",
    "Check that the Backplane-Power Supply harness is correctly placed to fit through the Umbilical Panel.",
  ),
  textStep(22, "AVC", "Set one DC Power supply to 25.2V at 2.0A, and turn the output on."),
  textStep(
    23,
    "AVC",
    "Connect the e-magnet to a second DC power supply. Be careful of wire polarity: + goes to +, - goes to -.",
  ),
  textStep(24, "AVC", "Set the e-magnet DC Power supply to 12.0V at 1.0A, and turn the output on."),
  textStep(25, "AVC", "Arm SRAD Avionics."),
  textStep(26, "AVC", "Turn off the output of the e-magnet DC power supply."),
];
