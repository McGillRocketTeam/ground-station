import { ProcedureStep } from "@mrt/yamcs-effect";

const textStep = (stepNumber: number, role: string, text: string) =>
  ProcedureStep.make({ type: "text", stepNumber, role, text });

export const energeticsWiringAndGfrpAssemblyProcedureSteps = [
  ProcedureStep.make({
    type: "note",
    text: "Energetics, wiring, and GFRP Assembly Procedures",
    color: "#EF8DBC",
  }),
  ProcedureStep.make({ type: "note", text: "Recov wiring, energetics", color: "#C6E0B4" }),
  textStep(
    1,
    "EJC",
    "Load 0.1 g of FFFF black powder around the e-match into each CO2 chargewell, and insert the metal pin followed by the spring. Attach a 25g CO2 cartridge on each pneumatic chargewell on the main plate.",
  ),
  textStep(
    2,
    "EJC",
    "Load 5 g of FFFF black powder in the main plate's black powder chargewell. Put on the silicone cap chargewell and use a zip-tie to fully secure the rubber cup onto the charge well, and place the e-match into the black powder through the cap.",
  ),
  textStep(
    3,
    "RCC",
    "Confirm that each Main BP chargewell cover contains an E-Match and has been secured with a zip-tie.",
  ),
  textStep(
    4,
    "RCC & EJC",
    "Use quicklink to connect II section of harness to harness section I and the main plate.",
  ),
  textStep(
    5,
    "EJC & RCC",
    "Connect the SM3 recovery wires to the CO2 cannister E-Matches using wago connectors.",
  ),
  textStep(
    6,
    "EJC & RCC",
    "Connect the CM3 recovery wires to the BP chargewell E-Matches using wago connectors.",
  ),
  textStep(7, "RCC", "Connect the SD3 XT-30 connectors."),
  textStep(8, "RCC", "Connect the CD3 XT-30 connectors."),
  textStep(
    9,
    "EJC & RCC",
    "Route SRAD & COTS main ejection wiring so that it is close to the plate using zip ties.",
  ),
  textStep(
    10,
    "RCC & EJC",
    "Attach the COTS & SRAD recovery wiring to the harness using zip-ties.",
  ),
  textStep(
    11,
    "AEC & EJC",
    "Place main plate in GFRP, ensure it is not angled wrt the axis of the rocket.",
  ),
  textStep(12, "RCC", "Attach the H harness section to the G section using a quicklink."),
  textStep(13, "RCC", "Attach both SD2 bullet connectors."),
  textStep(14, "RCC", "Attach both CD2 bullet connectors."),
  textStep(
    15,
    "AEC & EJC",
    "Place the coupler into the GFRP with the coupler flush against the main plate. Ensure coupler is oriented correctly.",
  ),
  textStep(
    16,
    "AEC & EJC",
    "Push Coupler into the GFRP until the main plate is flush against the spacer. Be careful of coupler orientation.",
  ),
  textStep(17, "AEC & EJC", "Fasten main set of shear pins using 6 #8-32 shear pins"),
  ProcedureStep.make({
    type: "note",
    text: "WARNING!! The rocket now contains energetics. Do not stand in front of the rocket.",
    color: "#FEBFBF",
  }),
  ProcedureStep.make({
    type: "note",
    text: "The Energetics, wiring, and GFRP Assembly sub assembly is complete. Bones have been loaded.",
    color: "#FFF798",
  }),
];
