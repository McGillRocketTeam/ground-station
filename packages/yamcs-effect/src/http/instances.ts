import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import { YamcsInstance } from "../schema.js";

export const instancesGroup = HttpApiGroup.make("instances").add(
  HttpApiEndpoint.get("listInstances", "/instances", {
    success: Schema.Struct({
      instances: Schema.Array(YamcsInstance),
    }),
    error: [HttpApiError.NotFound],
  }),
);

export default instancesGroup;
