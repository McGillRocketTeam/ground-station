import { HttpApiClient } from "@effect/platform";
import {
  NodeContext,
  NodeHttpClient,
  NodeRuntime,
} from "@effect/platform-node";
import { Effect, Layer, Ref, Schedule, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";
import * as dgram from "node:dgram";
import { NamedObjectId, ParameterInfo, Value } from "@mrt/yamcs-effect/";
import { YamcsApi } from "@mrt/yamcs-effect/src/http";

const ParameterValue = Schema.Struct({
  id: NamedObjectId,
  generationTime: Schema.Date,
  engValue: Value,
});

const ParameterPayload = Schema.Struct({
  parameter: Schema.Array(
    Schema.Struct({
      id: NamedObjectId,
      generationTime: Schema.Date,
      engValue: Value,
    }),
  ),
});

const encodePayload = Schema.encode(ParameterPayload);

type ParameterValue = typeof ParameterValue.Type;

const randomValueForType = (
  type: { name: string; engType: string },
  seed: number,
): typeof Value.Type | null => {
  const rand = Math.sin(seed) * 10000;
  const float = rand - Math.floor(rand);
  const int = Math.abs(Math.floor(rand));

  switch (type.engType) {
    case "float":
      // Check type.name for precision hint
      if (type.name.includes("float64") || type.name.includes("double")) {
        return { type: "DOUBLE", value: float * 100 };
      }
      return { type: "FLOAT", value: float * 100 };

    case "integer":
      // Check type.name for signedness and size
      if (type.name.includes("uint64")) {
        return { type: "UINT64", value: int };
      }
      if (type.name.includes("sint64") || type.name.includes("int64")) {
        return { type: "SINT64", value: int };
      }
      if (type.name.includes("uint")) {
        return { type: "UINT32", value: int % 1000 };
      }
      return { type: "SINT32", value: int % 1000 };

    case "string":
      return { type: "STRING", value: `value_${int}` };

    case "boolean":
      return { type: "BOOLEAN", value: int % 2 === 0 };

    case "enumeration":
      // Enumerations are typically sent as strings
      return { type: "STRING", value: "NOMINAL" };

    case "aggregate":
      // Skip aggregates for now
      return null;

    default:
      return null;
  }
};

// Update generateBatch to pass the full type object
const generateBatch = (
  parameters: readonly (typeof ParameterInfo.Type)[],
  seed: number,
  generationTime: Date,
): ParameterValue[] => {
  const result: ParameterValue[] = [];

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    const engValue = randomValueForType(param.type, seed + i);
    if (engValue) {
      result.push({
        id: { name: param.qualifiedName },
        generationTime,
        engValue,
      });
    }
  }

  return result;
};

const chunk = <T>(arr: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

// Format date as ISO string with Z suffix (matching Python's behavior)
const formatGenerationTime = (date: Date): string => date.toISOString();

// Send parameter values via UDP
const sendUdp = (
  values: ParameterValue[],
  host: string,
  port: number,
  chunkSize = 50,
): Effect.Effect<void, Error | ParseError> =>
  Effect.acquireUseRelease(
    Effect.sync(() => dgram.createSocket("udp4")),
    (socket) =>
      Effect.forEach(
        chunk(values, chunkSize),
        (batch) =>
          Effect.gen(function* () {
            const encoded = yield* encodePayload({
              parameter: batch.map((v) => ({
                id: v.id,
                generationTime: v.generationTime,
                engValue: v.engValue,
              })),
            });

            const payload = JSON.stringify(encoded);

            yield* Effect.async<void, Error>((resume) => {
              socket.send(Buffer.from(payload), port, host, (err) => {
                if (err) {
                  resume(
                    Effect.fail(new Error(`UDP send failed: ${err.message}`)),
                  );
                } else {
                  resume(Effect.succeed(undefined));
                }
              });
            });
          }),
        { discard: true },
      ),
    (socket) => Effect.sync(() => socket.close()),
  );

const simulator = Effect.gen(function* () {
  const yamcsHttp = yield* HttpApiClient.make(YamcsApi, {
    baseUrl: "http://localhost:8090",
  });

  const { parameters } = yield* yamcsHttp.mdb.listParameters({
    path: { instance: "ground_station" },
    urlParams: {},
  });

  const seedRef = yield* Ref.make(1);

  yield* Effect.gen(function* () {
    const seed = yield* Ref.getAndUpdate(seedRef, (n) => n + 1);
    const generationTime = new Date();
    const batch = generateBatch(parameters, seed, generationTime);

    yield* sendUdp(batch, "localhost", 11016);
    yield* Effect.log(`Sent ${batch.length} values at seed ${seed}`);
  }).pipe(Effect.repeat(Schedule.spaced("1 seconds")));
}).pipe(
  Effect.catchTag("RequestError", () =>
    Effect.logError(
      "Unable to request data from YAMCS. Are you running the backend on port 8090?",
    ),
  ),
  Effect.catchAll((err) => Effect.logError(`Error: ${err}`)),
);

const simulatorLayer = Layer.mergeAll(NodeContext.layer, NodeHttpClient.layer);

NodeRuntime.runMain(simulator.pipe(Effect.provide(simulatorLayer)));
