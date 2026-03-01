import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import { CommandId, LinkInfo, QualifiedName } from "../schema.js";

const instanceParam = HttpApiSchema.param("instance", Schema.String);
const linkParam = HttpApiSchema.param("link", QualifiedName);

export const idParam = HttpApiSchema.param("id", CommandId);

export const linkGroup = HttpApiGroup.make("link")
  .add(
    HttpApiEndpoint.get("listLinks")`/${instanceParam}`.addSuccess(
      Schema.Struct({
        links: Schema.Array(LinkInfo),
      }),
    ),
  )
  .add(HttpApiEndpoint.get("getLink")`/${instanceParam}/${linkParam}`.addSuccess(LinkInfo))
  .add(
    HttpApiEndpoint.post("enableLink")`/${instanceParam}/${linkParam}%3Aenable`.addSuccess(
      LinkInfo,
    ),
  )
  .add(
    HttpApiEndpoint.post("disableLink")`/${instanceParam}/${linkParam}%3Adisable`.addSuccess(
      LinkInfo,
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "resetCounters",
    )`/${instanceParam}/${linkParam}%3AresetCounters`.addSuccess(LinkInfo),
  )
  .prefix("/links")
  .addError(HttpApiError.NotFound);

export default linkGroup;
