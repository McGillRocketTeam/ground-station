import { BrowserHttpClient, BrowserSocket } from "@effect/platform-browser";
import {
  Parameters,
  type QualifiedName,
  YamcsConfig,
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

const parameterRuntime = Atom.runtime(parameterLayer);

export const currentTimeAtom = parameterRuntime.atom(
  Stream.fromSchedule(Schedule.spaced("1 second")).pipe(
    Stream.mapEffect(() => Clock.currentTimeMillis),
  ),
);

export const parameterSubscriptionAtom = Atom.family((qualifiedName: QualifiedName) =>
  parameterRuntime.atom(
    Stream.unwrap(
      Parameters.use((parameters) =>
        parameters
          .subscribe(qualifiedName)
          .pipe(Effect.map((subscription) => subscription.updates)),
      ),
    ),
  ),
);
