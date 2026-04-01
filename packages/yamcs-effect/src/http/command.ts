import { Schema } from "effect";
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiError,
} from "effect/unstable/httpapi";

import {
  CommandHistoryEntry,
  IssueCommandRequest,
  IssueCommandResponse,
} from "../schema.js";

const ListCommandsResponse = Schema.Struct({
  commands: Schema.Array(CommandHistoryEntry),

  continuationToken: Schema.optional(Schema.String),
});

export const commandGroup = HttpApiGroup.make("command")
  .add(
    HttpApiEndpoint.get("listCommands", "/archive/:instance/commands", {
      params: { instance: Schema.String },
      success: ListCommandsResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("getCommand", "/archive/:instance/commands/:id", {
      params: {
        instance: Schema.String,
        id: Schema.String,
      },
      success: CommandHistoryEntry,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "issueCommand",
      "/processors/:instance/:processor/commands/:name",
      {
        payload: Schema.UndefinedOr(IssueCommandRequest),
        params: {
          instance: Schema.String,
          processor: Schema.String,
          name: Schema.String,
        },
        success: IssueCommandResponse,
        error: [HttpApiError.NotFound],
      },
    ),
  );

export default commandGroup;
