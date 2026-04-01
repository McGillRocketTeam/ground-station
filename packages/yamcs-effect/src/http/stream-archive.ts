import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import { QualifiedName } from "../schema.js";

const StreamArchiveDelimiter = Schema.Literals(["TAB", "COMMA", "SEMICOLON"]);
const StreamArchiveExtraColumn = Schema.Literals(["raw", "monitoring"]);
export const StreamArchiveHeader = Schema.Literals([
  "QUALIFIED_NAME",
  "SHORT_NAME",
  "NONE",
]);
const StreamArchiveOrder = Schema.Literals(["asc", "desc"]);

const ExportParameterValuesQuery = {
  start: Schema.DateTimeUtcFromString,
  stop: Schema.optional(Schema.DateTimeUtcFromString),
  parameters: Schema.optional(Schema.Array(QualifiedName)),
  list: Schema.optional(Schema.String),
  namespace: Schema.optional(Schema.String),
  extra: Schema.optional(Schema.Array(StreamArchiveExtraColumn)),
  delimiter: Schema.optional(StreamArchiveDelimiter),
  interval: Schema.optional(Schema.NumberFromString),
  preserveLastValue: Schema.optional(Schema.String),
  pos: Schema.optional(Schema.NumberFromString),
  limit: Schema.optional(Schema.NumberFromString),
  order: Schema.optional(StreamArchiveOrder),
  filename: Schema.optional(Schema.String),
  header: Schema.optional(StreamArchiveHeader),
};

const CsvResponse = Schema.String.pipe(
  HttpApiSchema.asText({ contentType: "text/csv" }),
);

export const streamArchiveGroup = HttpApiGroup.make("streamArchive").add(
  HttpApiEndpoint.get(
    "exportParameterValues",
    "/archive/:instance%3AexportParameterValues",
    {
      params: {
        instance: Schema.String,
      },
      query: ExportParameterValuesQuery,
      success: CsvResponse,
      error: [HttpApiError.NotFound],
    },
  ),
);

export default streamArchiveGroup;
