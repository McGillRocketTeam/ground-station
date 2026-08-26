import { initialMediaState, type MediaState } from "@mrt/media-state";
import { Effect, Option, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ControlState, layerLocal, layerRemote } from "./control-state.ts";

export const ControlMode = Schema.Literals(["local", "remote"]);
export type ControlMode = typeof ControlMode.Type;

const requestedMode = new URLSearchParams(window.location.search).get("control");
const initialMode = Schema.decodeUnknownOption(ControlMode)(requestedMode).pipe(
  Option.getOrElse((): ControlMode => "remote"),
);

export const controlModeAtom = Atom.make<ControlMode>(initialMode);

const runtime = Atom.runtime((get) =>
  get(controlModeAtom) === "remote" ? layerRemote : layerLocal,
);

export const mediaStateAtom = runtime.atom(
  Stream.unwrap(ControlState.asEffect().pipe(Effect.map((service) => service.changes))),
  {
    initialValue: initialMediaState,
  },
);

export const setMediaStateAtom = runtime.fn<MediaState>()((state) =>
  ControlState.use((service) => service.set(state)),
);

export const selectMediaState = (result: AsyncResult.AsyncResult<MediaState, unknown>) =>
  AsyncResult.getOrElse(result, () => initialMediaState);
