import { Parameters, type QualifiedName } from "@mrt/yamcs-effect";
import { Effect, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { selectedInstanceAtom } from "../frontend";
import { YamcsAtomHttpClient } from "./runtime";
import { yamcsSubscriptionRuntime } from "./runtime";

export const parameterInfoAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom((get) => {
    if (!get(selectedInstanceAtom)) {
      return Effect.never;
    }

    return Parameters.use((service) => service.get(qualifiedName)).pipe(
      Effect.tapCause((cause) =>
        Effect.logError(`[yamcs] parameter info failed (${qualifiedName})`, cause),
      ),
    );
  }),
);

export const parameterDetailAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom((get) => {
    const instance = get(selectedInstanceAtom);

    if (!instance) {
      return Effect.never;
    }

    return get.result(
      YamcsAtomHttpClient.query("mdb", "getParameter", {
        params: {
          instance,
          name: qualifiedName,
        },
      }),
    );
  }),
);

export const parameterListAtom = yamcsSubscriptionRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Effect.never;
  }

  return Parameters.use((service) => Effect.succeed(service.all)).pipe(
    Effect.tapCause((cause) => Effect.logError("[yamcs] parameter list failed", cause)),
  );
});

export const parameterSubscriptionAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom((get) => {
    if (!get(selectedInstanceAtom)) {
      return Stream.never;
    }

    return Stream.unwrap(
      Effect.gen(function* () {
        const parameters = yield* Parameters;
        const subscription = yield* parameters.subscribe(qualifiedName);
        return subscription.updates.pipe(
          Stream.tapError((error) =>
            Effect.logError(
              `[yamcs] parameter subscription stream failed (${qualifiedName})`,
              error,
            ),
          ),
        );
        // .pipe(
        // 	Stream.throttle({
        // 		cost: (chunk) => chunk.length,
        // 		units: 1,
        // 		duration: "100 millis",
        // 		strategy: "enforce",
        // 	}),
        // );
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.logError(`[yamcs] parameter subscription failed (${qualifiedName})`, cause),
        ),
      ),
    );
  }),
);
