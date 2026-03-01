import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import { CommandId, Event } from "../schema.js";

const instanceParam = HttpApiSchema.param("instance", Schema.String);

export const idParam = HttpApiSchema.param("id", CommandId);

export const eventGroup = HttpApiGroup.make("event")
  .add(
    HttpApiEndpoint.get(
      "listEvents",
    )`/archive/${instanceParam}/events?source=ASTRA&limit=500&order=asc`.addSuccess(
      Schema.Struct({
        events: Schema.Array(Event),
      }),
    ),
  )
  .addError(HttpApiError.NotFound);

export default eventGroup;
