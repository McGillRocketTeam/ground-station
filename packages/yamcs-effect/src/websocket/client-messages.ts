import { Schema } from "effect";
import { NamedObjectId } from "../schema.js";

/*     Built-in Client Messages     */
export const Cancel = Schema.Struct({
  type: Schema.Literal("cancel"),
  options: Schema.Struct({
    call: Schema.NonNegativeInt,
  }),
});

export const State = Schema.Struct({
  type: Schema.Literal("state"),
});

export const SubscribeTimeRequest = Schema.TaggedStruct("time", {
  instance: Schema.String,
  processor: Schema.String,
});

export const SubscribeLinksRequest = Schema.TaggedStruct("links", {
  instance: Schema.String,
});

export const SubscribeCommandsRequest = Schema.TaggedStruct("commands", {
  instance: Schema.String,
  processor: Schema.String,
  ingorePastCommands: Schema.optional(Schema.Boolean),
});

export const SubscribeParameterRequest = Schema.TaggedStruct("parameters", {
  instance: Schema.String,
  processor: Schema.String,
  id: Schema.Array(NamedObjectId),
});

export const SubscriptionRequest = Schema.Union(
  SubscribeTimeRequest,
  SubscribeLinksRequest,
  SubscribeCommandsRequest,
  SubscribeParameterRequest,
);
