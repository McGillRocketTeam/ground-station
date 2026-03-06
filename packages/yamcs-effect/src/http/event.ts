import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import { Event } from "../schema.js";

const ListEventsResponse = Schema.Struct({
  events: Schema.Array(Event),
});

export const eventGroup = HttpApiGroup.make("event").add(
  HttpApiEndpoint.get("listEvents", "/archive/:instance/events", {
    params: { instance: Schema.String },
    query: {
      source: Schema.optional(Schema.String),
      limit: Schema.optional(Schema.String),
      order: Schema.optional(Schema.String),
    },
    success: ListEventsResponse,
    error: [HttpApiError.NotFound],
  }),
);

export default eventGroup;
