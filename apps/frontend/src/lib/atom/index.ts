import { ParameterInfo, ParameterValue, YamcsSubscriptions } from "@mrt/yamcs-effect";
import { Effect, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

export { AlarmSound, AlarmSoundError, playAlarmSoundAtom, stopAlarmSoundAtom } from "./alarm-sound";
export {
  selectedInstanceAtom,
  ThemeFromJsonString,
  themeAtom,
  themeStorageKey,
  type Theme,
} from "./frontend";
export { logValidationFailure, YamcsAtomHttpClient, yamcsBaseUrl } from "./yamcs/runtime";
export {
  acknowledgeAlarmAtom,
  alarmListAtom,
  alarmSummaryAtom,
  alarmsSubscriptionAtom,
  parameterAlarmSeverityAtom,
  parameterAlarmStateAtom,
  parameterHasActiveAlarmAtom,
} from "./yamcs/alarm";
export {
  parameterDetailAtom,
  parameterInfoAtom,
  parameterListAtom,
  parameterSubscriptionAtom,
} from "./yamcs/parameters";
export {
  commandHistoryEntryAtom,
  commandListAtom,
  commandsSubscriptionAtom,
} from "./yamcs/commands";

import { selectedInstanceAtom } from "./frontend";
import {
  logValidationFailure,
  YamcsAtomHttpClient,
  yamcsSubscriptionRuntime,
} from "./yamcs/runtime";

type ArchivedEvent = typeof import("@mrt/yamcs-effect").Event.Type;
type ArchivedLink = typeof import("@mrt/yamcs-effect").LinkInfo.Type;

export interface LiveParameterUpdate {
  readonly info: typeof ParameterInfo.Type;
  readonly value: typeof ParameterValue.Type;
}

export const timeSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Stream.never;
  }

  return Stream.unwrap(
    Effect.gen(function* () {
      const subscriptions = yield* YamcsSubscriptions;
      return subscriptions.time.pipe(
        Stream.tapError((error) => Effect.logError("[yamcs] time stream failed", error)),
      );
    }).pipe(Effect.tapCause((cause) => Effect.logError("[yamcs] time subscription failed", cause))),
  );
});

export const linksSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) => {
  const instance = get(selectedInstanceAtom);

  if (!instance) {
    return Stream.never;
  }

  return Stream.unwrap(
    Effect.gen(function* () {
      const { links: priorLinks } = yield* Effect.orElseSucceed(
        Effect.tapError(
          get.result(
            YamcsAtomHttpClient.query("link", "listLinks", {
              params: { instance },
            }),
          ),
          (error) =>
            logValidationFailure(`links initial query (${instance})`, error, {
              instance,
            }),
        ),
        () => ({
          links: [] as ReadonlyArray<ArchivedLink>,
        }),
      );
      const subscriptions = yield* YamcsSubscriptions;

      return Stream.concat(Stream.succeed(priorLinks), subscriptions.links).pipe(
        Stream.tapError((error) =>
          Effect.logError(`[yamcs] links stream failed (${instance})`, error),
        ),
      );
    }).pipe(
      Effect.tapCause((cause) => Effect.logError("[yamcs] links subscription failed", cause)),
    ),
  );
});

export const singleLinkSubscriptionAtom = Atom.family((name: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(linksSubscriptionAtom), (links) =>
      links.find((link) => link.name === name),
    ),
  ),
);

export const eventsSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) => {
  const instance = get(selectedInstanceAtom);

  if (!instance) {
    return Stream.never;
  }

  return Stream.unwrap(
    Effect.gen(function* () {
      const priorEvents: Array<ArchivedEvent> = [];
      let next: string | undefined;

      while (true) {
        const response = yield* Effect.orElseSucceed(
          Effect.tapError(
            get.result(
              YamcsAtomHttpClient.query("event", "listEvents", {
                params: { instance },
                query: next ? { next } : {},
              }),
            ),
            (error) =>
              logValidationFailure(`events archive query (${instance})`, error, {
                instance,
                next,
              }),
          ),
          () => ({
            events: [] as ReadonlyArray<ArchivedEvent>,
            continuationToken: undefined,
          }),
        );

        priorEvents.push(...response.events);

        if (!response.continuationToken) {
          break;
        }

        next = response.continuationToken;
      }

      const subscriptions = yield* YamcsSubscriptions;
      const initial = [...priorEvents].reverse();

      return Stream.concat(Stream.succeed(initial), subscriptions.events(initial)).pipe(
        Stream.tapError((error) =>
          Effect.logError(`[yamcs] events stream failed (${instance})`, error),
        ),
      );
    }).pipe(
      Effect.tapCause((cause) => Effect.logError("[yamcs] events subscription failed", cause)),
    ),
  );
});
