import { Context } from "effect";

export interface YamcsConfigShape {
  readonly url: URL;
  readonly instance: string;
  readonly processor: string;
}

export class YamcsConfig extends Context.Service<YamcsConfig, YamcsConfigShape>()(
  "@mrt/yamcs-effect/YamcsConfig",
) {}
