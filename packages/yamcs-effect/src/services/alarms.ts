import {
  Context,
  Data,
  DateTime,
  Effect,
  Layer,
  RcMap,
  Schema,
  Scope,
  SubscriptionRef,
  Stream,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { Socket } from "effect/unstable/socket";

import { YamcsApi } from "../http/index.ts";
import { AlarmData, NamedObjectId, type QualifiedName } from "../schema.ts";
import { SubscribeAlarmsRequest } from "../websocket/client-messages.ts";
import { YamcsWebSocketClient } from "../websocket/client.ts";
import { AlarmsEvent } from "../websocket/server-messages.ts";
import { YamcsConfig } from "../yamcs-config.ts";

export class AlarmServiceError extends Data.TaggedError("AlarmServiceError")<{
  readonly operation:
    | "initialize"
    | "subscribe"
    | "subscribeParameter"
    | "acknowledge"
    | "shelve"
    | "unshelve"
    | "clear";
  readonly cause: unknown;
}> {}

export interface AlarmSubscription {
  readonly alarms: Stream.Stream<ReadonlyArray<typeof AlarmData.Type>, AlarmServiceError>;
}

export interface ParameterAlarmState {
  readonly active: boolean;
  readonly alarms: ReadonlyArray<typeof AlarmData.Type>;
  readonly highestSeverity: (typeof AlarmData.Type)["severity"] | undefined;
}

export interface ParameterAlarmSubscription {
  readonly state: Stream.Stream<ParameterAlarmState, AlarmServiceError>;
}

export interface AlarmLookup {
  readonly id: typeof NamedObjectId.Type;
  readonly seqNum: number;
}

export interface AlarmActionTarget {
  readonly alarmName: QualifiedName;
  readonly seqNum: number;
}

export interface ShelveAlarmOptions extends AlarmActionTarget {
  readonly comment: string;
  readonly shelveDuration?: number | undefined;
}

interface AlarmStore {
  readonly alarmsByKey: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, typeof AlarmData.Type>>;
}

const alarmStoreKey = Symbol.for("@mrt/yamcs-effect/Alarms/store");

const storeAlarmKey = (alarm: AlarmLookup) =>
  `${alarm.id.namespace ?? ""}:${alarm.id.name}:${alarm.seqNum}`;

const alarmSeverityRank: Record<(typeof AlarmData.Type)["severity"], number> = {
  WATCH: 0,
  WARNING: 1,
  DISTRESS: 2,
  CRITICAL: 3,
  SEVERE: 4,
};

const sortAlarms = (alarmsByKey: ReadonlyMap<string, typeof AlarmData.Type>) =>
  Array.from(alarmsByKey.values()).sort(
    (left, right) =>
      DateTime.toEpochMillis(right.updateTime ?? right.triggerTime) -
        DateTime.toEpochMillis(left.updateTime ?? left.triggerTime) ||
      DateTime.toEpochMillis(right.triggerTime) - DateTime.toEpochMillis(left.triggerTime) ||
      right.seqNum - left.seqNum,
  );

const sortAlarmList = (alarms: ReadonlyArray<typeof AlarmData.Type>) =>
  [...alarms].sort(
    (left, right) =>
      alarmSeverityRank[right.severity] - alarmSeverityRank[left.severity] ||
      DateTime.toEpochMillis(right.updateTime ?? right.triggerTime) -
        DateTime.toEpochMillis(left.updateTime ?? left.triggerTime) ||
      DateTime.toEpochMillis(right.triggerTime) - DateTime.toEpochMillis(left.triggerTime) ||
      right.seqNum - left.seqNum,
  );

const isTerminalAlarmUpdate = (alarm: typeof AlarmData.Type) =>
  alarm.notificationType === "CLEARED" || alarm.notificationType === "RESET";

const mergeAlarmIntoState = (
  alarmsByKey: ReadonlyMap<string, typeof AlarmData.Type>,
  alarm: typeof AlarmData.Type,
) => {
  const next = new Map(alarmsByKey);
  const key = storeAlarmKey(alarm);

  if (isTerminalAlarmUpdate(alarm)) {
    next.delete(key);
    return next;
  }

  next.set(key, alarm);
  return next;
};

const getAlarmParameterQualifiedName = (alarm: typeof AlarmData.Type) => {
  if (alarm.type !== "PARAMETER") {
    return undefined;
  }

  return alarm.parameterDetail?.parameter?.qualifiedName ?? alarm.id.name;
};

const sameAlarmList = (
  left: ReadonlyArray<typeof AlarmData.Type>,
  right: ReadonlyArray<typeof AlarmData.Type>,
) => left.length === right.length && left.every((alarm, index) => alarm === right[index]);

const deriveParameterAlarmState = (
  alarmsByKey: ReadonlyMap<string, typeof AlarmData.Type>,
  qualifiedName: QualifiedName,
  previous?: ParameterAlarmState,
): ParameterAlarmState => {
  const alarms = sortAlarmList(
    Array.from(alarmsByKey.values()).filter(
      (alarm) => getAlarmParameterQualifiedName(alarm) === qualifiedName,
    ),
  );
  const highestSeverity = alarms[0]?.severity;

  if (
    previous !== undefined &&
    previous.active === alarms.length > 0 &&
    previous.highestSeverity === highestSeverity &&
    sameAlarmList(previous.alarms, alarms)
  ) {
    return previous;
  }

  return {
    active: alarms.length > 0,
    alarms,
    highestSeverity,
  };
};

export class Alarms extends Context.Service<
  Alarms,
  {
    readonly list: Effect.Effect<
      ReadonlyArray<typeof AlarmData.Type>,
      AlarmServiceError,
      Scope.Scope
    >;
    readonly get: (
      lookup: AlarmLookup,
    ) => Effect.Effect<typeof AlarmData.Type | undefined, AlarmServiceError, Scope.Scope>;
    readonly getParameter: (
      qualifiedName: QualifiedName,
    ) => Effect.Effect<ParameterAlarmState, AlarmServiceError, Scope.Scope>;
    readonly subscribe: () => Effect.Effect<AlarmSubscription, AlarmServiceError, Scope.Scope>;
    readonly subscribeParameter: (
      qualifiedName: QualifiedName,
    ) => Effect.Effect<ParameterAlarmSubscription, AlarmServiceError, Scope.Scope>;
    readonly acknowledge: (
      target: AlarmActionTarget & { comment: string },
    ) => Effect.Effect<void, AlarmServiceError>;
    readonly shelve: (options: ShelveAlarmOptions) => Effect.Effect<void, AlarmServiceError>;
    readonly unshelve: (target: AlarmActionTarget) => Effect.Effect<void, AlarmServiceError>;
    readonly clear: (
      target: AlarmActionTarget & { comment: string },
    ) => Effect.Effect<void, AlarmServiceError>;
  }
>()("@mrt/yamcs-effect/Alarms") {
  static readonly layer = Layer.effect(
    Alarms,
    Effect.gen(function* () {
      const websocketClient = yield* YamcsWebSocketClient;
      const yamcsConfig = yield* YamcsConfig;
      const httpClient = yield* HttpApiClient.make(YamcsApi, {
        transformClient: (client) =>
          HttpClient.mapRequest(client, (request) =>
            HttpClientRequest.setUrl(
              request,
              new URL(request.url.replaceAll("%3A", ":"), yamcsConfig.url).toString(),
            ),
          ),
      });

      const alarmStoreMap = yield* RcMap.make<
        typeof alarmStoreKey,
        AlarmStore,
        Schema.SchemaError | Socket.SocketError | unknown,
        Scope.Scope
      >({
        lookup: () =>
          Effect.acquireRelease(
            Effect.gen(function* () {
              const { alarms: initialAlarms } = yield* httpClient.alarm.listProcessorAlarms({
                params: {
                  instance: yamcsConfig.instance,
                  processor: yamcsConfig.processor,
                },
                query: {
                  includePending: true,
                },
              });

              let initialAlarmsByKey = new Map<string, typeof AlarmData.Type>();

              for (const alarm of initialAlarms) {
                initialAlarmsByKey = mergeAlarmIntoState(initialAlarmsByKey, alarm);
              }

              const alarmsByKey =
                yield* SubscriptionRef.make<ReadonlyMap<string, typeof AlarmData.Type>>(
                  initialAlarmsByKey,
                );

              const { call, stream } = yield* websocketClient.subscribe(
                SubscribeAlarmsRequest.make({
                  instance: yamcsConfig.instance,
                  processor: yamcsConfig.processor,
                  includePending: true,
                }),
              );

              yield* stream.pipe(
                Stream.mapEffect((message) => Schema.decodeUnknownEffect(AlarmsEvent)(message)),
                Stream.map((message) => message.data),
                Stream.runForEach((alarm) =>
                  SubscriptionRef.update(alarmsByKey, (current) =>
                    mergeAlarmIntoState(current, alarm),
                  ),
                ),
                Effect.forkScoped,
              );

              return {
                call,
                store: { alarmsByKey } satisfies AlarmStore,
              };
            }),
            ({ call }) => Effect.orElseSucceed(websocketClient.unsubscribe(call), () => undefined),
          ).pipe(Effect.map(({ store }) => store)),
      });

      const getStore = Effect.fn("Alarms.getStore")(function* () {
        return yield* RcMap.get(alarmStoreMap, alarmStoreKey).pipe(
          Effect.mapError((cause) => new AlarmServiceError({ operation: "initialize", cause })),
        );
      });

      const list = getStore().pipe(
        Effect.flatMap((store) => SubscriptionRef.get(store.alarmsByKey)),
        Effect.map(sortAlarms),
      );

      const get = Effect.fn("Alarms.get")(function* (lookup: AlarmLookup) {
        const store = yield* getStore();
        const current = yield* SubscriptionRef.get(store.alarmsByKey);

        return current.get(storeAlarmKey(lookup));
      });

      const getParameter = Effect.fn("Alarms.getParameter")(function* (
        qualifiedName: QualifiedName,
      ) {
        const store = yield* getStore();
        const current = yield* SubscriptionRef.get(store.alarmsByKey);

        return deriveParameterAlarmState(current, qualifiedName);
      });

      const subscribe = Effect.fn("Alarms.subscribe")(function* () {
        const store = yield* getStore();
        const initial = yield* SubscriptionRef.get(store.alarmsByKey);

        return {
          alarms: Stream.concat(
            Stream.succeed(sortAlarms(initial)),
            SubscriptionRef.changes(store.alarmsByKey).pipe(
              Stream.map(sortAlarms),
              Stream.mapError((cause) => new AlarmServiceError({ operation: "subscribe", cause })),
            ),
          ),
        } satisfies AlarmSubscription;
      });

      const subscribeParameter = Effect.fn("Alarms.subscribeParameter")(function* (
        qualifiedName: QualifiedName,
      ) {
        const store = yield* getStore();
        const initial = yield* SubscriptionRef.get(store.alarmsByKey);

        return {
          state: Stream.suspend(() => {
            let previous = deriveParameterAlarmState(initial, qualifiedName);

            return Stream.concat(
              Stream.succeed(previous),
              SubscriptionRef.changes(store.alarmsByKey).pipe(
                Stream.map((current) => {
                  const next = deriveParameterAlarmState(current, qualifiedName, previous);
                  previous = next;
                  return next;
                }),
                Stream.changes,
                Stream.mapError(
                  (cause) => new AlarmServiceError({ operation: "subscribeParameter", cause }),
                ),
              ),
            );
          }),
        } satisfies ParameterAlarmSubscription;
      });

      const acknowledge = (target: AlarmActionTarget & { comment: string }) =>
        Effect.mapError(
          httpClient.alarm.acknowledgeAlarm({
            params: {
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
              alarm: target.alarmName,
              seqnum: target.seqNum,
            },
            payload: {
              comment: target.comment,
            },
          }),
          (cause) => new AlarmServiceError({ operation: "acknowledge", cause }),
        );

      const shelve = (options: ShelveAlarmOptions) =>
        Effect.mapError(
          httpClient.alarm.shelveAlarm({
            params: {
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
              alarm: options.alarmName,
              seqnum: options.seqNum,
            },
            payload: {
              comment: options.comment,
              shelveDuration: options.shelveDuration,
            },
          }),
          (cause) => new AlarmServiceError({ operation: "shelve", cause }),
        );

      const unshelve = (target: AlarmActionTarget) =>
        Effect.mapError(
          httpClient.alarm.unshelveAlarm({
            params: {
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
              alarm: target.alarmName,
              seqnum: target.seqNum,
            },
          }),
          (cause) => new AlarmServiceError({ operation: "unshelve", cause }),
        );

      const clear = (target: AlarmActionTarget & { comment: string }) =>
        Effect.mapError(
          httpClient.alarm.clearAlarm({
            params: {
              instance: yamcsConfig.instance,
              processor: yamcsConfig.processor,
              alarm: target.alarmName,
              seqnum: target.seqNum,
            },
            payload: {
              comment: target.comment,
            },
          }),
          (cause) => new AlarmServiceError({ operation: "clear", cause }),
        );

      return {
        list,
        get,
        getParameter,
        subscribe,
        subscribeParameter,
        acknowledge,
        shelve,
        unshelve,
        clear,
      };
    }),
  );
}
