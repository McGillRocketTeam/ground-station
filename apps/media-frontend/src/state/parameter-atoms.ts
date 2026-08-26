import { BrowserHttpClient, BrowserSocket } from "@effect/platform-browser";
import {
  Parameters,
  type QualifiedName,
  YamcsConfig,
  YamcsSubscriptions,
  YamcsWebSocketClient,
} from "@mrt/yamcs-effect";
import { Clock, Effect, Layer, Schedule, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

const yamcsConfigLayer = Layer.succeed(YamcsConfig, {
  url: new URL("/", window.location.origin),
  instance: import.meta.env.VITE_YAMCS_INSTANCE ?? "launch-canada",
  processor: import.meta.env.VITE_YAMCS_PROCESSOR ?? "realtime",
});

const websocketClientLayer = YamcsWebSocketClient.layer.pipe(
  Layer.provide([yamcsConfigLayer, BrowserSocket.layerWebSocketConstructor]),
);

const parameterLayer = Parameters.layer.pipe(
  Layer.provide([yamcsConfigLayer, websocketClientLayer, BrowserHttpClient.layerFetch]),
);

const subscriptionsLayer = YamcsSubscriptions.layer.pipe(
  Layer.provide([yamcsConfigLayer, websocketClientLayer]),
);

const yamcsRuntime = Atom.runtime(Layer.merge(parameterLayer, subscriptionsLayer));

export const currentTimeAtom = yamcsRuntime.atom(
  Stream.fromSchedule(Schedule.spaced("1 second")).pipe(
    Stream.mapEffect(() => Clock.currentTimeMillis),
  ),
);

export const missionTimeAtom = yamcsRuntime.atom(
  Stream.unwrap(YamcsSubscriptions.use((subscriptions) => Effect.succeed(subscriptions.time))),
);

export const parameterSubscriptionAtom = Atom.family((qualifiedName: QualifiedName) =>
  yamcsRuntime.atom(
    Stream.unwrap(
      Parameters.use((parameters) =>
        parameters
          .subscribe(qualifiedName)
          .pipe(Effect.map((subscription) => subscription.updates)),
      ),
    ),
  ),
);
