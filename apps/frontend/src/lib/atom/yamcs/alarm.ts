import { BrowserSocket } from "@effect/platform-browser";
import { Alarms, type QualifiedName } from "@mrt/yamcs-effect";
import { YamcsConfig } from "@mrt/yamcs-effect";
import { Effect, Layer, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { selectedInstanceAtom } from "../frontend";
import { yamcsBaseUrl, yamcsHttpClientLayer, YamcsAtomHttpClient } from "./runtime";

export const yamcsAlarmRuntime = YamcsAtomHttpClient.runtime.factory((get) => {
  const yamcsConfigLayer = Layer.succeed(YamcsConfig, {
    url: new URL(yamcsBaseUrl),
    instance: get(selectedInstanceAtom),
    processor: "realtime",
  });
  return Layer.provideMerge(
    Alarms.layer,
    Layer.merge(
      Layer.merge(yamcsConfigLayer, BrowserSocket.layerWebSocketConstructor),
      yamcsHttpClientLayer,
    ),
  );
});

export const alarmListAtom = yamcsAlarmRuntime.atom(Alarms.use((service) => service.list));

export const alarmsSubscriptionAtom = yamcsAlarmRuntime.atom(
  Stream.unwrap(
    Alarms.use((service) => Effect.map(service.subscribe(), (subscription) => subscription.alarms)),
  ),
);

export const parameterAlarmStateAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsAlarmRuntime.atom(
    Stream.unwrap(
      Alarms.use((service) =>
        Effect.map(service.subscribeParameter(qualifiedName), (subscription) => subscription.state),
      ),
    ),
  ),
);

export const parameterHasActiveAlarmAtom = Atom.family((qualifiedName: QualifiedName) =>
  Atom.make((get) =>
    AsyncResult.map(get(parameterAlarmStateAtom(qualifiedName)), (state) => state.active),
  ),
);
