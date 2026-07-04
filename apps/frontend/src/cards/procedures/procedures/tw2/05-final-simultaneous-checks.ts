import { ProcedureStep } from "@mrt/yamcs-effect";

export const finalSimultaneousChecksSteps = [
  ProcedureStep.make({
    type: "note",
    text: "The following steps can be done simultaneously and are organized by LD/PD.",
    color: "#FFDFBF",
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 64,
    role: "OP1 & OP5",
    text: [
      "1. Remove foreign objects and flammables from launch pad, including tower supports",
      "2. Secure rail stop",
      "3. Stand by for igniter placement",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 65,
    role: "OP2 & OP4",
    text: [
      "1. Wet ground in front of deflector plate",
      "2. Return to safety radius and stand at manual dump lines",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 66,
    role: "OP3",
    text: [
      "1. Adjust deflector plate camera",
      "2. Connect AV umbilical box to external power supply",
      "3. Broadcast to PD and LD that SRAD system is about to be turned on",
      "4. Turn on the SRAD system with the SRAD electromagnet by flipping the SRAD switch to the on/off position on the AV umbilical Box.",
      "5. Broadcast to PD and LD that COTS system is about to be turned on",
      "6. Turn on COTS system while broadcasting to LD and PD that it is being done",
      "7. Do a final continuity check",
      "8. Return to safety radius",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 67,
    role: "CS to PD",
    text: "Confirm reception of telemetry and payload data from the AV bay over radio.",
  }),
  ProcedureStep.make({
    type: "command",
    stepNumber: 68,
    role: "CS",
    name: "/FlightComputer/propulsion_on",
    comment: 'Energize the propulsion controllers by pressing the "Prop On" button on the GUI.',
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 69,
    role: "LD",
    text: [
      "Confirm that the following sensors are reading ambient values.",
      "",
      "Pre-fill Pressure: _____ psi",
      "Post-fill Pressure: _____ psi",
      "Tank Pressure: _____ psi",
      "Combustion Chamber Pressure: _____ psi",
      "Pre-fill Temperature: _____ °C",
      "Tank Temperature: _____ °C",
      "Vent Temperature: _____ °C",
    ].join("\n"),
  }),
  ProcedureStep.make({
    type: "text",
    stepNumber: 70,
    role: "LD",
    text: [
      "Confirm that the GPS data is credible (should indicate a position near LC vertical launch area, 47.98737, -81.84874.) and that the Altitude is giving credible data (approx at 400m)",
      "",
      "GPS values: ____________________",
      "Altitude values: _____  ft/m",
    ].join("\n"),
  }),
];
