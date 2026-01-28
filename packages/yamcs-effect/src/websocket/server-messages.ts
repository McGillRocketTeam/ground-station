import { Schema } from "effect";
import {
  LinkInfo,
  NamedObjectId,
  StreamingCommandHisotryEntry,
  Value,
} from "../schema";

export const SubscriptionId = Schema.NonNegativeInt.pipe(
  Schema.brand("SubscriptionId"),
);

export type SubscriptionId = typeof SubscriptionId.Type;

/*     Built-in Server Messages     */
export const Reply = Schema.Struct({
  type: Schema.Literal("reply"),
  call: Schema.optional(SubscriptionId),
  // seq: Schema.NonNegativeInt,
  data: Schema.Struct({
    replyTo: Schema.optional(SubscriptionId),
    exception: Schema.optional(
      Schema.Struct({
        code: Schema.NonNegativeInt,
        type: Schema.String,
        msg: Schema.String,
      }),
    ),
  }),
});

export const ServerState = Schema.Struct({
  type: Schema.Literal("state"),
  data: Schema.Struct({
    calls: Schema.Array(
      Schema.Struct({
        call: SubscriptionId,
        type: Schema.String,
        options: Schema.optional(Schema.Any),
      }),
    ),
  }),
});

/*     Event Server Messages     */
export const Update = Schema.Struct({
  type: Schema.String,
  call: SubscriptionId,
  seq: Schema.NonNegativeInt,
  data: Schema.Unknown,
});

export const TimeEvent = Schema.Struct({
  type: Schema.Literal("time"),
  call: SubscriptionId,
  seq: Schema.NonNegativeInt,
  data: Schema.Struct({
    value: Schema.DateFromString,
  }),
});

export const LinkEvent = Schema.Struct({
  type: Schema.Literal("links"),
  call: SubscriptionId,
  seq: Schema.NonNegativeInt,
  data: Schema.Struct({
    links: Schema.Array(LinkInfo),
  }),
});

export const CommandHistoryEvent = Schema.Struct({
  type: Schema.Literal("commands"),
  call: SubscriptionId,
  seq: Schema.NonNegativeInt,
  data: StreamingCommandHisotryEntry,
});

export const ParameterValue = Schema.Struct({
  // id: NamedObjectId,
  rawValue: Schema.optional(Value),
  engValue: Value,
  acquisitionTime: Schema.optional(Schema.DateFromString),
  generationTime: Schema.DateFromString, // RFC 3339 timestamp
  numericId: Schema.Number,
});

export const PrameterDataEvent = Schema.Struct({
  values: Schema.Array(ParameterValue),
});

export const ParmeterInfoEvent = Schema.Struct({
  mapping: Schema.Record({ key: Schema.String, value: NamedObjectId }),
  // info: Schema.Record({ key: Schema.Number, value: ParameterInfo }),
});

export const ParameterEvent = Schema.Union(
  ParmeterInfoEvent,
  PrameterDataEvent,
);

export const Events = Schema.Union(Update);

export const Messages = Schema.Union(Reply, ServerState, Update);
export type Messages = typeof Messages.Type;
