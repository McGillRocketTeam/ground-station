import { Effect, Schema } from "effect";
import { HttpApiGroup, HttpApiEndpoint, HttpApiError } from "effect/unstable/httpapi";

import { AlarmData, QualifiedName } from "../schema.js";

const ListAlarmsOptions = {
  pos: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.String),
  start: Schema.optional(Schema.String),
  stop: Schema.optional(Schema.String),
  order: Schema.optional(Schema.Literals(["asc", "desc"])),
  next: Schema.optional(Schema.String),
};

const ListAlarmsResponse = Schema.Struct({
  alarms: Schema.Array(AlarmData).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  continuationToken: Schema.optional(Schema.String),
});

const ListProcessorAlarmsResponse = Schema.Struct({
  alarms: Schema.Array(AlarmData).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

const AcknowledgeAlarmRequest = Schema.Struct({
  comment: Schema.String,
});

const ShelveAlarmRequest = Schema.Struct({
  comment: Schema.String,
  shelveDuration: Schema.optional(Schema.NumberFromString),
});

const ClearAlarmRequest = Schema.Struct({
  comment: Schema.String,
});

const AlarmEndpointParams = {
  instance: Schema.String,
  processor: Schema.String,
  alarm: QualifiedName,
  seqnum: Schema.NumberFromString,
};

export const alarmGroup = HttpApiGroup.make("alarm")
  .add(
    HttpApiEndpoint.get("listAlarms", "/archive/:instance/alarms/:name", {
      params: {
        instance: Schema.String,
        name: QualifiedName,
      },
      query: ListAlarmsOptions,
      success: ListAlarmsResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("listProcessorAlarms", "/processors/:instance/:processor/alarms", {
      params: {
        instance: Schema.String,
        processor: Schema.String,
      },
      query: {
        includePending: Schema.optional(Schema.Boolean),
      },
      success: ListProcessorAlarmsResponse,
      error: [HttpApiError.NotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "acknowledgeAlarm",
      "/processors/:instance/:processor/alarms/:alarm/:seqnum%3Aacknowledge",
      {
        params: AlarmEndpointParams,
        payload: AcknowledgeAlarmRequest,
        success: Schema.Void,
        error: [HttpApiError.NotFound],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "shelveAlarm",
      "/processors/:instance/:processor/alarms/:alarm/:seqnum%3Ashelve",
      {
        params: AlarmEndpointParams,
        payload: ShelveAlarmRequest,
        success: Schema.Void,
        error: [HttpApiError.NotFound],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "unshelveAlarm",
      "/processors/:instance/:processor/alarms/:alarm/:seqnum%3Aunshelve",
      {
        params: AlarmEndpointParams,
        success: Schema.Void,
        error: [HttpApiError.NotFound],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "clearAlarm",
      "/processors/:instance/:processor/alarms/:alarm/:seqnum%3Aclear",
      {
        params: AlarmEndpointParams,
        payload: ClearAlarmRequest,
        success: Schema.Void,
        error: [HttpApiError.NotFound],
      },
    ),
  );

export default alarmGroup;
