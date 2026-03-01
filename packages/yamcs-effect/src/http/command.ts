import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import {
  CommandHistoryEntry,
  CommandId,
  IssueCommandRequest,
  IssueCommandResponse,
  QualifiedName,
} from "../schema.js";

const processorParam = HttpApiSchema.param("processor", Schema.String);
const instanceParam = HttpApiSchema.param("instance", Schema.String);
const nameParam = HttpApiSchema.param("name", QualifiedName);

export const idParam = HttpApiSchema.param("id", CommandId);

const ListCommandsResponse = Schema.Struct({
  commands: Schema.Array(CommandHistoryEntry),

  continuationToken: Schema.optional(Schema.String),
});

export const commandGroup = HttpApiGroup.make("command")
  .add(
    HttpApiEndpoint.get("listCommands")`/archive/${instanceParam}/commands`.addSuccess(
      ListCommandsResponse,
    ),
  )
  .add(
    HttpApiEndpoint.get("getCommand")`/archive/${instanceParam}/commands/${idParam}`.addSuccess(
      CommandHistoryEntry,
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "issueCommand",
    )`/processors/${instanceParam}/${processorParam}/commands/${nameParam}`
      .setPayload(IssueCommandRequest)
      .addSuccess(IssueCommandResponse),
  )
  .addError(HttpApiError.NotFound);

export default commandGroup;
