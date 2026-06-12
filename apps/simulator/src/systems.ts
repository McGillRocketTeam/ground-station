import { Effect } from "effect";

import { makeFlightComputerSimulation } from "./devices/flight-computer.ts";
import { makeRadioActor } from "./devices/radio.ts";
import { runAstraActor, type AstraActor } from "./Simulator.ts";
import { SIMULATOR_RADIO_LOCATION, SIMULATOR_SYSTEM } from "./utils/Config.ts";

type RadioLocation = "Pad" | "ControlStation";

interface SystemTopology {
  readonly systemName: string;
  readonly radioLocations: ReadonlyArray<RadioLocation>;
  readonly commandSender: RadioLocation;
}

const launchCanadaTopologies: ReadonlyArray<SystemTopology> = [
  {
    systemName: "SystemA",
    radioLocations: ["Pad", "ControlStation"],
    commandSender: "Pad",
  },
  {
    systemName: "SystemB",
    radioLocations: ["Pad", "ControlStation"],
    commandSender: "Pad",
  },
];

const urrgTopologies: ReadonlyArray<SystemTopology> = [
  {
    systemName: "SystemA",
    radioLocations: ["ControlStation"],
    commandSender: "ControlStation",
  },
  {
    systemName: "SystemB",
    radioLocations: ["ControlStation"],
    commandSender: "ControlStation",
  },
];

const topologiesForInstance = (instance: string): ReadonlyArray<SystemTopology> => {
  switch (instance) {
    case "launch-canada":
      return launchCanadaTopologies;
    case "urrg":
      return urrgTopologies;
    default:
      throw new Error(
        `Unsupported YAMCS instance "${instance}" for @mrt/simulator. Supported instances: launch-canada, urrg.`,
      );
  }
};

export const makeSimulatorForInstance = (instance: string) =>
  Effect.gen(function* () {
    const selectedSystem = yield* SIMULATOR_SYSTEM;
    const selectedLocation = yield* SIMULATOR_RADIO_LOCATION;
    const topology = topologiesForInstance(instance).find(
      (candidate) => candidate.systemName === selectedSystem,
    );

    if (topology === undefined) {
      throw new Error(
        `Unsupported simulator system "${selectedSystem}" for instance "${instance}".`,
      );
    }

    if (!topology.radioLocations.includes(selectedLocation)) {
      throw new Error(
        `Radio location "${selectedLocation}" is not available for system "${selectedSystem}" in instance "${instance}".`,
      );
    }

    const flightComputer = yield* makeFlightComputerSimulation(
      `${topology.systemName}/Rocket/FlightComputer`,
    );
    const actor = (yield* makeRadioActor({
      baseTopic: `${topology.systemName}/${selectedLocation}/Radio`,
      role: selectedLocation,
      forwardsFlightComputerCommands: selectedLocation === topology.commandSender,
      flightComputer,
    })) as AstraActor<unknown>;

    return yield* runAstraActor(actor);
  });
