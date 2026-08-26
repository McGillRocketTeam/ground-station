import { Commands } from "@mrt/yamcs-effect";
import { Effect, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { selectedInstanceAtom } from "../frontend";
import { yamcsSubscriptionRuntime } from "./runtime";

export const commandListAtom = yamcsSubscriptionRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Effect.never;
  }

  return Commands.use((service) => service.list).pipe(
    Effect.tapCause((cause) => Effect.logError("[yamcs] command list failed", cause)),
  );
});

export const commandsSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Stream.never;
  }

  return Stream.unwrap(
    Commands.use((service) =>
      Effect.map(service.subscribeHistory(), (subscription) =>
        subscription.entries.pipe(
          Stream.tapError((error) =>
            Effect.logError("[yamcs] command history stream failed", error),
          ),
        ),
      ),
    ).pipe(
      Effect.tapCause((cause) =>
        Effect.logError("[yamcs] command history subscription failed", cause),
      ),
    ),
  );
});

export const commandHistoryEntryAtom = Atom.family((commandId: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(commandsSubscriptionAtom), (commands) =>
      commands.find((command) => command.id === commandId),
    ),
  ),
);
