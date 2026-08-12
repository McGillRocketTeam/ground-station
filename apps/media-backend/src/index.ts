import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";

import { MediaStateRpcLive } from "./Control/rpc.ts";

const HealthRoute = HttpRouter.use(
  Effect.fn("MediaBackend.healthRoute")(function* (router) {
    yield* router.add("GET", "/", Effect.succeed(HttpServerResponse.text("ok")));
  }),
);

const Routes = Layer.merge(RpcServer.layerProtocolHttp({ path: "/rpc" }), HealthRoute).pipe(
  Layer.provide(HttpRouter.layer),
);

const ServerLive = MediaStateRpcLive.pipe(
  Layer.provideMerge(Routes),
  Layer.provide(HttpRouter.serve(Routes)),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(Logger.layer([Logger.consolePretty()])),
);

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);
