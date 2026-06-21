import { Commands } from "@mrt/yamcs-effect";
import { Effect, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { yamcsSubscriptionRuntime } from "./runtime";

export const commandListAtom = yamcsSubscriptionRuntime.atom(
  Commands.use((service) => service.list),
);

export const commandsSubscriptionAtom = yamcsSubscriptionRuntime.atom(
  Stream.unwrap(
    Commands.use((service) =>
      Effect.map(service.subscribeHistory(), (subscription) => subscription.entries),
    ),
  ),
);

export const commandHistoryEntryAtom = Atom.family((commandId: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(commandsSubscriptionAtom), (commands) =>
      commands.find((command) => command.id === commandId),
    ),
  ),
);
