import { Effect } from "effect";

import { makeFlightComputerSimulation } from "./devices/flight-computer.ts";
import { makeRadioActor } from "./devices/radio.ts";
import { runAstraActor, type AstraActor } from "./Simulator.ts";

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

const topologiesForInstance = (
  instance: string,
): ReadonlyArray<SystemTopology> => {
  switch (instance) {
    case "launch-canada":
      return launchCanadaTopologies;
    default:
      return urrgTopologies;
  }
};

const makeSystemActors = (topology: SystemTopology) =>
  Effect.gen(function* () {
    const flightComputer = yield* makeFlightComputerSimulation(
      `${topology.systemName}/Rocket/FlightComputer`,
    );

    return yield* Effect.forEach(
      topology.radioLocations,
      (location) =>
        makeRadioActor({
          baseTopic: `${topology.systemName}/${location}/Radio`,
          role: location,
          forwardsFlightComputerCommands: location === topology.commandSender,
          flightComputer,
        }),
      { concurrency: "unbounded" },
    );
  });

export const makeSimulatorForInstance = (instance: string) =>
  Effect.gen(function* () {
    const actorGroups = yield* Effect.forEach(
      topologiesForInstance(instance),
      makeSystemActors,
      { concurrency: "unbounded" },
    );

    const actors = actorGroups.flat() as Array<AstraActor<unknown>>;

    yield* Effect.forEach(actors, runAstraActor, { concurrency: "unbounded" });
  });
