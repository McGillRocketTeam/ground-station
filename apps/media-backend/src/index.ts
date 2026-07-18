import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer, Logger } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "http";

import { MediaClientRoutes } from "./Media/api.ts";

const ApiLive = HttpRouter.serve(MediaClientRoutes).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);

const server = ApiLive.pipe(Layer.provide(Logger.layer([Logger.consolePretty()])));

Layer.launch(server).pipe(NodeRuntime.runMain);
