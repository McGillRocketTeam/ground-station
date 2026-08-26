import type { PrimarySystem } from "@mrt/media-state";

export const flightComputerParameter = (system: PrimarySystem, name: string) =>
  `/${system}/Rocket/FlightComputer/${name}`;
