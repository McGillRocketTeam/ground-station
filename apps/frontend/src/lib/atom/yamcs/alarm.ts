import { Alarms, type QualifiedName } from "@mrt/yamcs-effect";
import { Effect, Layer, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { AlarmSound } from "../alarm-sound";
import { selectedInstanceAtom } from "../frontend";
import { yamcsSubscriptionRuntime } from "./runtime";

type AlarmData = typeof import("@mrt/yamcs-effect").AlarmData.Type;

export interface AlarmSummary {
  readonly acknowledgedCount: number;
  readonly count: number;
  readonly hasUnacked: boolean;
  readonly highestSeverity: AlarmData["severity"] | undefined;
  readonly unacknowledgedCount: number;
}

export interface AcknowledgeAlarmInput {
  readonly alarmName: QualifiedName;
  readonly seqNum: number;
}

function summarizeAlarms(alarms: ReadonlyArray<AlarmData>): AlarmSummary {
  const unshelvedAlarms = alarms.filter((alarm) => alarm.shelveInfo === undefined);
  const unacknowledgedAlarms = unshelvedAlarms.filter((alarm) => !alarm.acknowledged);
  const severityRank = {
    WATCH: 0,
    WARNING: 1,
    DISTRESS: 2,
    CRITICAL: 3,
    SEVERE: 4,
  } satisfies Record<AlarmData["severity"], number>;
  const highestSeverity = unacknowledgedAlarms.reduce<AlarmData["severity"] | undefined>(
    (highest, alarm) =>
      highest === undefined || severityRank[alarm.severity] > severityRank[highest]
        ? alarm.severity
        : highest,
    undefined,
  );

  return {
    acknowledgedCount: unshelvedAlarms.length - unacknowledgedAlarms.length,
    count: unshelvedAlarms.length,
    hasUnacked: unacknowledgedAlarms.length > 0,
    highestSeverity,
    unacknowledgedCount: unacknowledgedAlarms.length,
  };
}

const alarmRuntime = yamcsSubscriptionRuntime.factory((get) =>
  get(yamcsSubscriptionRuntime.layer).pipe(Layer.merge(AlarmSound.layer)),
);

export const alarmListAtom = yamcsSubscriptionRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Effect.never;
  }

  return Alarms.use((service) => service.list).pipe(
    Effect.tapCause((cause) => Effect.logError("[yamcs] alarm list failed", cause)),
  );
});

export const alarmsSubscriptionAtom = yamcsSubscriptionRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Stream.never;
  }

  return Stream.unwrap(
    Alarms.use((service) =>
      Effect.map(service.subscribe(), (subscription) =>
        subscription.alarms.pipe(
          Stream.tapError((error) => Effect.logError("[yamcs] alarm stream failed", error)),
        ),
      ),
    ).pipe(Effect.tapCause((cause) => Effect.logError("[yamcs] alarm subscription failed", cause))),
  );
});

export const alarmSummaryAtom = alarmRuntime.atom((get) => {
  if (!get(selectedInstanceAtom)) {
    return Stream.never;
  }

  return Stream.unwrap(
    Alarms.use((service) =>
      Effect.map(service.subscribe(), (subscription) =>
        subscription.alarms.pipe(
          Stream.map(summarizeAlarms),
          Stream.changesWith(
            (previous, current) =>
              previous.acknowledgedCount === current.acknowledgedCount &&
              previous.highestSeverity === current.highestSeverity &&
              previous.unacknowledgedCount === current.unacknowledgedCount,
          ),
          Stream.tap((summary) =>
            AlarmSound.use((sound) =>
              summary.highestSeverity === "CRITICAL" || summary.highestSeverity === "SEVERE"
                ? sound.play
                : sound.stop,
            ),
          ),
          Stream.tapError((error) => Effect.logError("[yamcs] alarm summary stream failed", error)),
          Stream.ensuring(AlarmSound.use((sound) => sound.stop)),
        ),
      ),
    ).pipe(
      Effect.tapCause((cause) =>
        Effect.logError("[yamcs] alarm summary subscription failed", cause),
      ),
    ),
  );
});

export const acknowledgeAlarmAtom = yamcsSubscriptionRuntime.fn<AcknowledgeAlarmInput>()(
  ({ alarmName, seqNum }) =>
    Alarms.use((service) =>
      service.acknowledge({
        alarmName,
        seqNum,
        comment: "Acknowledged from alarm list",
      }),
    ).pipe(Effect.tapCause((cause) => Effect.logError("[yamcs] acknowledge alarm failed", cause))),
);

export const parameterAlarmStateAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom((get) => {
    if (!get(selectedInstanceAtom)) {
      return Stream.never;
    }

    return Stream.unwrap(
      Alarms.use((service) =>
        Effect.map(service.subscribeParameter(qualifiedName), (subscription) =>
          subscription.state.pipe(
            Stream.tapError((error) =>
              Effect.logError(`[yamcs] parameter alarm stream failed (${qualifiedName})`, error),
            ),
          ),
        ),
      ).pipe(
        Effect.tapCause((cause) =>
          Effect.logError(`[yamcs] parameter alarm subscription failed (${qualifiedName})`, cause),
        ),
      ),
    );
  }),
);

export const parameterHasActiveAlarmAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom((get) => {
    if (!get(selectedInstanceAtom)) {
      return Stream.never;
    }

    return Stream.unwrap(
      Alarms.use((service) =>
        Effect.map(service.subscribeParameter(qualifiedName), (subscription) =>
          subscription.state.pipe(
            Stream.map((state) => state.active),
            Stream.changes,
            Stream.tapError((error) =>
              Effect.logError(
                `[yamcs] parameter active alarm stream failed (${qualifiedName})`,
                error,
              ),
            ),
          ),
        ),
      ).pipe(
        Effect.tapCause((cause) =>
          Effect.logError(
            `[yamcs] parameter active alarm subscription failed (${qualifiedName})`,
            cause,
          ),
        ),
      ),
    );
  }),
);

export const parameterAlarmSeverityAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsSubscriptionRuntime.atom((get) => {
    if (!get(selectedInstanceAtom)) {
      return Stream.never;
    }

    return Stream.unwrap(
      Alarms.use((service) =>
        Effect.map(service.subscribeParameter(qualifiedName), (subscription) =>
          subscription.state.pipe(
            Stream.map(
              (state) => state.alarms.find((alarm) => alarm.shelveInfo === undefined)?.severity,
            ),
            Stream.changes,
            Stream.tapError((error) =>
              Effect.logError(
                `[yamcs] parameter alarm severity stream failed (${qualifiedName})`,
                error,
              ),
            ),
          ),
        ),
      ).pipe(
        Effect.tapCause((cause) =>
          Effect.logError(
            `[yamcs] parameter alarm severity subscription failed (${qualifiedName})`,
            cause,
          ),
        ),
      ),
    );
  }),
);
