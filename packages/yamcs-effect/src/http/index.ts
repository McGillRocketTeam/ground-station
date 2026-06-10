import { HttpApi } from "effect/unstable/httpapi";

import commandGroup from "./command.js";
import eventGroup from "./event.js";
import instancesGroup from "./instances.ts";
import linkGroup from "./link.js";
import mdbGroup from "./mdb.js";
import parameterGroup from "./parameter.js";
import streamArchiveGroup from "./stream-archive.js";

export { StreamArchiveHeader } from "./stream-archive.js";

export const YamcsApi = HttpApi.make("YAMCS")
  .add(mdbGroup)
  .add(commandGroup)
  .add(linkGroup)
  .add(parameterGroup)
  .add(streamArchiveGroup)
  .add(eventGroup)
  .add(instancesGroup)
  .prefix("/api");
