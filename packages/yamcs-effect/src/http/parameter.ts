import { Effect, Schema } from "effect";
import { HttpApiGroup, HttpApiEndpoint, HttpApiError } from "effect/unstable/httpapi";

import { BatchSetParameterValuesRequest, ParameterSample, QualifiedName } from "../schema.js";

const ParameterSampleField = Schema.Literals([
  "time",
  "avg",
  "min",
  "max",
  "n",
  "minTime",
  "maxTime",
  "firstTime",
  "lastTime",
]);

const SamplesSource = Schema.Literals(["ParameterArchive", "replay"]);

const GetSamplesResponse = Schema.Struct({
  sample: Schema.Array(ParameterSample).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

export const parameterGroup = HttpApiGroup.make("parameter")
  .add(
    HttpApiEndpoint.get("getSamples", "/archive/:instance/parameters/:parameterName/samples", {
      params: {
        instance: Schema.String,
        parameterName: QualifiedName,
      },
      query: {
        start: Schema.String,
        stop: Schema.optional(Schema.String),
        count: Schema.optional(Schema.NumberFromString),
        fields: Schema.optional(Schema.Array(ParameterSampleField)),
        gapTime: Schema.optional(Schema.NumberFromString),
        source: Schema.optional(SamplesSource),
        useRawValue: Schema.optional(Schema.Boolean),
      },
      success: GetSamplesResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "batchSetParameterValues",
      "/processors/:instance/:processor/parameters%3AbatchSet",
      {
        params: {
          instance: Schema.String,
          processor: Schema.String,
        },
        payload: BatchSetParameterValuesRequest,
        success: Schema.Void,
        error: [HttpApiError.NotFound],
      },
    ),
  );

export default parameterGroup;
