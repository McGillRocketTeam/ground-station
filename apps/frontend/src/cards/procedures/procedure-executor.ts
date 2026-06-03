import type { ProcedureStack } from "@mrt/yamcs-effect";

import { Atom } from "effect/unstable/reactivity";

export const procedureExecutorAtom = Atom.family((stack: ProcedureStack) => Atom.make(stack));
