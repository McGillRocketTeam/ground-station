import type { QualifiedName } from "typescript";

import { Context, Effect } from "effect";

export class Commands extends Context.Service<
  Commands,
  {
    readonly issue: (qualifiedName: QualifiedName) => Effect.Effect<void>;
  }
>()("@mrt/yamcs-effect/Commands") {}
