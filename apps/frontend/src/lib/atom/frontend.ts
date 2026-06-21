import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

const localStorageRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage);

const themeSchema = Schema.Literals(["dark", "light", "system"]);
export type Theme = typeof themeSchema.Type;

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
