export const countedProcedureCodes = ["TW1", "TW2", "TW3", "TW4"] as const;
export const procedureCodes = [...countedProcedureCodes, "TW5"] as const;

export type ProcedureCode = (typeof procedureCodes)[number];

export const procedureSteps: Record<ProcedureCode, { title: string; blurb: string }> = {
  TW1: {
    title: "Rocket assembly",
    blurb:
      "The team is assembling the propulsion, avionics, payload, recovery, energetics, and airframe systems, then validating the completed vehicle for flight.",
  },
  TW2: {
    title: "Pre-launch procedures",
    blurb:
      "Following flight approval, the vehicle is transported to the pad, installed on the rail, and put through ignition, valve, disconnect, avionics, and telemetry checks.",
  },
  TW3: {
    title: "Filling and arming",
    blurb:
      "Pad operators connect the nitrous supply and arm the pad box before returning to the control station, where the flight tank is filled remotely while pressure and temperature are monitored.",
  },
  TW4: {
    title: "Launch procedures",
    blurb:
      "With the pad clear, the fill line is vented and disconnected remotely, recovery and propulsion are armed, and the team proceeds through ignition, flight, and landing.",
  },
  TW5: {
    title: "Abort and safing procedures",
    blurb:
      "Following an abort, the team isolates and vents the propulsion system, disarms ignition, propulsion, ejection, and avionics, then secures the launch pad for safe access, teardown, and recovery.",
  },
};

export function getProcedureStep(code: ProcedureCode): number | undefined {
  const index = countedProcedureCodes.findIndex((countedCode) => countedCode === code);
  return index === -1 ? undefined : index + 1;
}

export function isProcedureCode(value: string): value is ProcedureCode {
  return procedureCodes.some((code) => code === value);
}
