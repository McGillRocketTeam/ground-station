import { ParameterInfo, ParameterValue, YamcsSubscriptions } from "@mrt/yamcs-effect";
import { Effect, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

export { selectedInstanceAtom, themeAtom, themeSchema, type Theme } from "./frontend";
export { logValidationFailure, YamcsAtomHttpClient, yamcsBaseUrl } from "./yamcs/runtime";
export {
  parameterInfoAtom,
  parameterListAtom,
  parameterSubscriptionAtom,
} from "./yamcs/parameters";
export {
  commandHistoryEntryAtom,
  commandInfoAtom,
  commandListAtom,
  commandsByQualifiedNameAtom,
  commandsSubscriptionAtom,
  sendCommandAtom,
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

export const timeSubscriptionAtom = yamcsSubscriptionRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const subscriptions = yield* YamcsSubscriptions;
      return subscriptions.time;
    }),
  ),
);

export const linksSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = get(selectedInstanceAtom);
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

      return Stream.concat(Stream.succeed(priorLinks), subscriptions.links);
    }),
  ),
);

export const singleLinkSubscriptionAtom = Atom.family((name: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(linksSubscriptionAtom), (links) =>
      links.find((link) => link.name === name),
    ),
  ),
);

export const eventsSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const instance = get(selectedInstanceAtom);
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

      return Stream.concat(Stream.succeed(initial), subscriptions.events(initial));
    }),
  ),
);
