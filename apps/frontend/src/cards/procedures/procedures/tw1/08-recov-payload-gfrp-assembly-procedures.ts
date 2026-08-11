import { ProcedureStep } from "@mrt/yamcs-effect";

const textStep = (stepNumber: number, role: string, text: string) =>
  ProcedureStep.make({ type: "text", stepNumber, role, text });

export const recovPayloadGfrpAssemblyProcedureSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Recov/Payload/GFRP Assembly Procedures",
    color: "#9CC7E5",
  }),
  textStep(1, "AEC", "Ensure all loose wires are ziptied through zipties mounts on payload bay"),
  textStep(2, "EJC", "Grease and place Payload -263 O-ring into Payload Ring."),
  textStep(
    3,
    "PAC & AEC",
    'Payload bay is placed through payload ring, compress O-ring, plate is secured to ring using 8 #10-32 3/4" button heads fasteners with loctite.',
  ),
  textStep(4, "AEC", "Torque the Payload bay fasteners to XXX Nm."),
  textStep(5, "EJC & RCC", "Put Plumber's putty around the Payload Plate to seal"),
  textStep(6, "AEC", "Place cf internal spacer in GFRP, flush against the payload plate."),
  textStep(
    7,
    "EJC",
    "Both the main and payload plate have their respective -264 O-rings wrapped around with PTFE tape, and sitting in the O-ring grooves.",
  ),
  ProcedureStep.make({
    type: "note",
    text: "The Recovery-Payload sub assembly is complete. Bones have been loaded.",
    color: "#FFF798",
  }),
];
