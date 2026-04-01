import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import { LinkInfo, QualifiedName } from "../schema.js";

const ListLinksResponse = Schema.Struct({
  links: Schema.Array(LinkInfo),
});

export const linkGroup = HttpApiGroup.make("link")
  .add(
    HttpApiEndpoint.get("listLinks", "/links/:instance", {
      params: { instance: Schema.String },
      success: ListLinksResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("getLink", "/links/:instance/:link", {
      params: {
        instance: Schema.String,
        link: QualifiedName,
      },
      success: LinkInfo,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post("enableLink", "/links/:instance/:link:enable", {
      params: {
        instance: Schema.String,
        link: QualifiedName,
      },
      success: LinkInfo,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post("disableLink", "/links/:instance/:link:disable", {
      params: {
        instance: Schema.String,
        link: QualifiedName,
      },
      success: LinkInfo,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "resetCounters",
      "/links/:instance/:link:resetCounters",
      {
        params: {
          instance: Schema.String,
          link: QualifiedName,
        },
        success: LinkInfo,
        error: [HttpApiError.NotFound],
      },
    ),
  );

export default linkGroup;
