import { Parameters, type QualifiedName } from "@mrt/yamcs-effect";
import { Effect, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { yamcsSubscriptionRuntime } from "./runtime";

export const parameterInfoAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom(Parameters.use((s) => s.get(qualifiedName))),
);

export const parameterListAtom = yamcsSubscriptionRuntime.atom(
  Parameters.use((s) => Effect.succeed(s.all)),
);

export const parameterSubscriptionAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const parameters = yield* Parameters;
        const subscription = yield* parameters.subscribe(qualifiedName);
        return subscription.updates;
        // .pipe(
        // 	Stream.throttle({
        // 		cost: (chunk) => chunk.length,
        // 		units: 1,
        // 		duration: "100 millis",
        // 		strategy: "enforce",
        // 	}),
        // );
      }),
    ),
  ),
);
