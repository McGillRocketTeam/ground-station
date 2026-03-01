import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import { CommandId, ParameterSample, QualifiedName } from "../schema.js";

const instanceParam = HttpApiSchema.param("instance", Schema.String);
const parameterNameParam = HttpApiSchema.param("parameterName", QualifiedName);

export const idParam = HttpApiSchema.param("id", CommandId);

export const parameterGroup = HttpApiGroup.make("parameter")
  .add(
    HttpApiEndpoint.get(
      "getSamples",
    )`/stream-archive/${instanceParam}/parameters/${parameterNameParam}/samples`
      .setUrlParams(
        Schema.Struct({
          start: Schema.DateFromString,
          stop: Schema.optional(Schema.DateFromString),
        }),
      )
      .addSuccess(
        Schema.Struct({
          sample: Schema.Array(ParameterSample),
        }),
      ),
  )
  .addError(HttpApiError.NotFound);

export default parameterGroup;
