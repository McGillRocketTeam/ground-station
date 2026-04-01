import { scheduleTask } from "@effect/atom-react";
import { AtomRegistry } from "effect/unstable/reactivity";

export const atomRegistry = AtomRegistry.make({
  scheduleTask,
  defaultIdleTTL: 400,
});
