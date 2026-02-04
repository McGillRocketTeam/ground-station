import { HttpApi } from "@effect/platform";
import commandGroup from "./command.js";
import linkGroup from "./link.js";
import mdbGroup from "./mdb.js";
import parameterGroup from "./parameter.js";
import eventGroup from "./event.js";

export const YamcsApi = HttpApi.make("YAMCS")
  .add(mdbGroup)
  .add(commandGroup)
  .add(linkGroup)
  .add(parameterGroup)
  .add(eventGroup)
  .prefix("/api");
