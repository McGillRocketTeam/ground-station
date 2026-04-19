import { Schema } from "effect";

import {
  LinkInfo,
  NamedObjectId,
  StreamingCommandHisotryEntry,
  Value,
  Event,
} from "../schema.js";

export const SubscriptionId = Schema.Int.pipe(Schema.brand("SubscriptionId"));

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
        code: Schema.Int,
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
  seq: Schema.Int,
  data: Schema.Unknown,
});

export const TimeEvent = Schema.Struct({
  type: Schema.Literal("time"),
  call: SubscriptionId,
  seq: Schema.Int,
  data: Schema.Struct({
    value: Schema.DateTimeUtcFromString,
  }),
});

export const LinkEvent = Schema.Struct({
  type: Schema.Literal("links"),
  call: SubscriptionId,
  seq: Schema.Int,
  data: Schema.Struct({
    links: Schema.Array(LinkInfo),
  }),
});

const CommandHistoryEventSchema = Schema.Struct({
  type: Schema.Literal("commands"),
  call: SubscriptionId,
  seq: Schema.Int,
  data: StreamingCommandHisotryEntry,
});

export type CommandHistoryEvent = typeof CommandHistoryEventSchema.Type;
export const CommandHistoryEvent: Schema.Codec<CommandHistoryEvent, unknown> =
  CommandHistoryEventSchema;

const ParameterValueSchema = Schema.Struct({
  // id: NamedObjectId,
  rawValue: Schema.optional(Value),
  engValue: Value,
  acquisitionTime: Schema.optional(Schema.DateTimeUtcFromString),
  generationTime: Schema.DateTimeUtcFromString, // RFC 3339 timestamp
  numericId: Schema.Number,
});

export type ParameterValue = typeof ParameterValueSchema.Type;
export const ParameterValue: Schema.Codec<ParameterValue, unknown> =
  ParameterValueSchema;

const PrameterDataEventSchema = Schema.Struct({
  values: Schema.Array(ParameterValue),
});

export type PrameterDataEvent = typeof PrameterDataEventSchema.Type;
export const PrameterDataEvent: Schema.Codec<PrameterDataEvent, unknown> =
  PrameterDataEventSchema;

export const ParmeterInfoEvent = Schema.Struct({
  mapping: Schema.Record(Schema.String, NamedObjectId),
  // info: Schema.Record({ key: Schema.Number, value: ParameterInfo }),
});

const ParameterEventSchema = Schema.Union([
  ParmeterInfoEvent,
  PrameterDataEvent,
]);

export type ParameterEvent = typeof ParameterEventSchema.Type;
export const ParameterEvent: Schema.Codec<ParameterEvent, unknown> =
  ParameterEventSchema;

export const EventsEvent = Schema.Struct({
  type: Schema.Literal("events"),
  call: SubscriptionId,
  seq: Schema.Int,
  data: Event,
});

export const Events = Schema.Union([Update]);

export const Messages = Schema.Union([Reply, ServerState, Update]);
export type Messages = typeof Messages.Type;
