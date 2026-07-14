import { Context } from "effect";

export interface YamcsConfigShape {
  readonly url: URL;
  readonly instance: string;
  readonly processor: string;
}

export const YamcsConfig = Context.Reference<YamcsConfigShape>("@mrt/yamcs-effect/YamcsConfig", {
  defaultValue: () => ({
    url: new URL("http://localhost:8090"),
    instance: "",
    processor: "realtime",
  }),
});
