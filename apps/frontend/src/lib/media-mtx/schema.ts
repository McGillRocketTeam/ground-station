import { Schema } from "effect";

export class MediaMtxServerError extends Schema.TaggedErrorClass<MediaMtxServerError>()(
  "MediaMtxServerError",
  {
    status: Schema.Literal("error"),
    error: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

export const PathSourceType = Schema.Literals([
  "hlsSource",
  "redirect",
  "rpiCameraSource",
  "rtmpConn",
  "rtmpsConn",
  "rtmpSource",
  "rtspSession",
  "rtspSource",
  "rtspsSession",
  "srtConn",
  "srtSource",
  "mpegtsSource",
  "rtpSource",
  "webRTCSession",
  "webRTCSource",
]);

export const PathReaderType = Schema.Literals([
  "hlsSession",
  "rtmpConn",
  "rtmpsConn",
  "rtspConn",
  "rtspSession",
  "rtspsConn",
  "rtspsSession",
  "srtConn",
  "webRTCSession",
]);

export const PathTrackCodec = Schema.Literals([
  "AV1",
  "VP9",
  "VP8",
  "H265",
  "H264",
  "MPEG-4 Video",
  "MPEG-1/2 Video",
  "M-JPEG",
  "Opus",
  "Vorbis",
  "MPEG-4 Audio",
  "MPEG-4 Audio LATM",
  "MPEG-1/2 Audio",
  "AC3",
  "Speex",
  "G726",
  "G722",
  "G711",
  "LPCM",
  "MPEG-TS",
  "KLV",
  "Generic",
]);

export const PathSource = Schema.Struct({
  type: PathSourceType,
  id: Schema.String,
});

export const PathReader = Schema.Struct({
  type: PathReaderType,
  id: Schema.String,
});

export const PathTrack = Schema.Struct({
  codec: PathTrackCodec,
  codecProps: Schema.NullOr(Schema.Unknown),
});

export const PathItem = Schema.Struct({
  name: Schema.String,
  confName: Schema.String,
  source: Schema.NullOr(PathSource),
  ready: Schema.Boolean,
  readyTime: Schema.NullOr(Schema.String),
  available: Schema.Boolean,
  availableTime: Schema.NullOr(Schema.String),
  online: Schema.Boolean,
  onlineTime: Schema.NullOr(Schema.String),
  tracks: Schema.Array(PathTrackCodec),
  tracks2: Schema.Array(PathTrack),
  inboundBytes: Schema.Number,
  outboundBytes: Schema.Number,
  inboundFramesInError: Schema.Number,
  bytesReceived: Schema.Number,
  bytesSent: Schema.Number,
  readers: Schema.Array(PathReader),
});

export const PathList = Schema.Struct({
  pageCount: Schema.Number,
  itemCount: Schema.Number,
  items: Schema.Array(PathItem),
});
