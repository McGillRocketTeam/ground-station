import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import { ParameterSample, QualifiedName } from "../schema.js";

const GetSamplesResponse = Schema.Struct({
  sample: Schema.Array(ParameterSample),
});

export const parameterGroup = HttpApiGroup.make("parameter").add(
  HttpApiEndpoint.get(
    "getSamples",
    "/stream-archive/:instance/parameters/:parameterName/samples",
    {
      params: {
        instance: Schema.String,
        parameterName: QualifiedName,
      },
      query: {
        start: Schema.String,
        stop: Schema.optional(Schema.String),
      },
      success: GetSamplesResponse,
      error: [HttpApiError.NotFound],
    },
  ),
);

export default parameterGroup;
