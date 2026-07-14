import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

const localStorageRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage);

const themeSchema = Schema.Literals(["dark", "light", "system"]);
export type Theme = typeof themeSchema.Type;

const redFlagTimeSchema = Schema.Struct({
  day: Schema.String,
  time: Schema.String,
});
export type RedFlagTime = typeof redFlagTimeSchema.Type;

export const selectedInstanceAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "mrt-selected-instance",
  schema: Schema.String,
  defaultValue: () => "",
});

export const themeAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "vite-ui-theme",
  schema: themeSchema,
  defaultValue: () => "system" as Theme,
});

export const redFlagTimeAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "mrt-red-flag-time",
  schema: redFlagTimeSchema,
  defaultValue: () => ({ day: "", time: "" }) as RedFlagTime,
});
