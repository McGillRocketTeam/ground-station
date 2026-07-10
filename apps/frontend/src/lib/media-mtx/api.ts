import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import * as S from "./schema";

export const generalGroup = HttpApiGroup.make("General", { topLevel: true }).add(
  HttpApiEndpoint.get("info", "/info", {
    success: Schema.Struct({
      version: Schema.String,
      started: Schema.String,
    }),
    error: [S.MediaMtxServerError],
  }),
);

export const pathsGroup = HttpApiGroup.make("Paths")
  .add(
    HttpApiEndpoint.get("list", "/list", {
      query: {
        page: Schema.optional(Schema.NumberFromString),
        itemsPerPage: Schema.optional(Schema.NumberFromString),
      },
      success: S.PathList,
      error: [S.MediaMtxServerError],
    }),
  )
  .prefix("/paths");

export const MediaMtxApi = HttpApi.make("MediaMtx").add(generalGroup).add(pathsGroup).prefix("/v3");
