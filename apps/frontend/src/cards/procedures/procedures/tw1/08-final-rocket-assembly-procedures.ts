import { ProcedureStep } from "@mrt/yamcs-effect";

const textStep = (stepNumber: number, role: string, text: string) =>
  ProcedureStep.make({ type: "text", stepNumber, role, text });

export const finalRocketAssemblyProcedureSteps = [
  ProcedureStep.make({ type: "note", text: "Final Rocket Assembly Procedures.", color: "#A3C293" }),
  textStep(1, "RCC & EJC", "Use quicklink to connect B section of harness to harness section C"),
  textStep(2, "EJC & RCC", "Connect Drogue E-Matches to DC1 & DS1 using WAGOS"),
  textStep(
    3,
    "EJC",
    "Load 3 g of FFFF black powder in each of the drogue plate chargewells. For each chargewell, put on the silicone cap and use zip-tie to fully secure the rubber cup onto the charge well, and place the e-match into the black powder through the cap.",
  ),
  textStep(
    4,
    "RCC",
    "Confirm that each Drogue chargewell cover contains an E-Match and has been secured with a zip-tie.",
  ),
  textStep(
    5,
    "RCC & EJC",
    "Use quicklink to connect AA section of harness to harness section A and the drogue plate.",
  ),
  textStep(
    6,
    "AEC & EJC",
    "Slide the nose cone over the drogue plate and coupler, secure with 6 #6-32 shear pins",
  ),
  textStep(
    7,
    "AVC",
    "Attach the Payload Harness between the payload Adapter PCB & the Backplane PCB.",
  ),
  textStep(8, "AVC", "Attach both CM4 XT-30 Connectors."),
  textStep(9, "AVC", "Attach both CD4 XT-30 Connectors."),
  textStep(10, "AVC", "Arm COTS avionics."),
  textStep(
    11,
    "AVC",
    "Confirm Blue Raven Electrical Continuity by listening for two beeps, and seeing two green LED flashes.",
  ),
  textStep(12, "AVC", "Verify Blue Raven is properly configured using Blue Raven Mobile App."),
  textStep(13, "AVC", "Disarm COTS avionics."),
  textStep(14, "AVC", "Switch the Featherweight GPS tracker power switch to on."),
  textStep(
    15,
    "CSC",
    "Verify the reception of packets on the Featherweight GPS Tracker ground station using the Blue Raven Mobile app.",
  ),
  ProcedureStep.make({
    type: "note",
    text: "The COTS avionics system is validated for flight.",
    color: "#FFF798",
  }),
  textStep(16, "AVC", "Attach both SM4 XT-30 Connectors."),
  textStep(17, "AVC", "Attach both SD4 XT-30 Connectors."),
];
