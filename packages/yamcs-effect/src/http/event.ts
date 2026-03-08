import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import { Event } from "../schema.js";

const ListEventsOptions = {
  pos: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.String),
  order: Schema.optional(Schema.Literals(["asc", "desc"])),
  severity: Schema.optional(
    Schema.Literals([
      "info",
      "watch",
      "warning",
      "distress",
      "critical",
      "severe",
    ]),
  ),
  source: Schema.optional(Schema.String),
  next: Schema.optional(Schema.String),
  start: Schema.optional(Schema.String),
  stop: Schema.optional(Schema.String),
  q: Schema.optional(Schema.String),
  filter: Schema.optional(Schema.String),
};

const ListEventsResponse = Schema.Struct({
  event: Schema.optional(Schema.Array(Event)),
  events: Schema.Array(Event),
  continuationToken: Schema.optional(Schema.String),
});

export const eventGroup = HttpApiGroup.make("event")
  .add(
    HttpApiEndpoint.get("listEvents", "/archive/:instance/events", {
      params: { instance: Schema.String },
      query: ListEventsOptions,
      success: ListEventsResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "listEventsWithPayload",
      "/archive/:instance/events:list",
      {
        params: { instance: Schema.String },
        payload: Schema.UndefinedOr(Schema.Struct(ListEventsOptions)),
        success: ListEventsResponse,
        error: [HttpApiError.NotFound],
      },
    ),
  );

export default eventGroup;
