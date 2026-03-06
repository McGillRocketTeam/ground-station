import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import * as yamcs from "../schema.js";

const ListParametersResponse = Schema.Struct({
  spaceSystems: Schema.optional(Schema.Array(yamcs.SpaceSystemInfo)),
  parameters: Schema.Array(yamcs.ParameterInfo),

  continuationToken: Schema.optional(Schema.String),
  totalSize: Schema.Int,
});

const ListCommandsResponse = Schema.Struct({
  spaceSystems: Schema.optional(Schema.Array(yamcs.SpaceSystemInfo)),
  commands: Schema.Array(yamcs.CommandInfo),

  continuationToken: Schema.optional(Schema.String),
  totalSize: Schema.Int,
});

const ListSpaceSystemsResponse = Schema.Struct({
  spaceSystems: Schema.Array(yamcs.SpaceSystemInfo),

  continuationToken: Schema.optional(Schema.String),
  totalSize: Schema.Int,
});

export const mdbGroup = HttpApiGroup.make("mdb")
  .add(
    HttpApiEndpoint.get("getMissionDatabase", "/mdb/:instance", {
      params: { instance: Schema.String },
      success: yamcs.MissionDatabase,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("listParameters", "/mdb/:instance/parameters", {
      params: { instance: Schema.String },
      query: {
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.String),
      },
      success: ListParametersResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("listCommands", "/mdb/:instance/commands", {
      params: { instance: Schema.String },
      query: {
        q: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.String),
      },
      success: ListCommandsResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("getContainer", "/mdb/:instance/containers/:name", {
      params: {
        instance: Schema.String,
        name: yamcs.QualifiedName,
      },
      success: yamcs.ContainerInfo,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("getParameter", "/mdb/:instance/parameters/:name", {
      params: {
        instance: Schema.String,
        name: yamcs.QualifiedName,
      },
      success: yamcs.ParameterInfo,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get(
      "getSpaceSystem",
      "/mdb/:instance/space-systems/:name",
      {
        params: {
          instance: Schema.String,
          name: yamcs.QualifiedName,
        },
        success: yamcs.SpaceSystemInfo,
        error: [HttpApiError.NotFound],
      },
    ),
  )
  .add(
    HttpApiEndpoint.get("listSpaceSystems", "/mdb/:instance/space-systems", {
      params: { instance: Schema.String },
      success: ListSpaceSystemsResponse,
      error: [HttpApiError.NotFound],
    }),
  );

export default mdbGroup;
