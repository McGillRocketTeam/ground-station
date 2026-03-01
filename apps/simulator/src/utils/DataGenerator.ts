import { Effect, Layer, Ref, ServiceMap } from "effect";

import type { DataEncoding } from "./Container.ts";

import { DATA_MODE } from "./Config.ts";

const intRange = (enc: DataEncoding & { type: "INTEGER" }) => {
  if (enc.encoding === "TWOS_COMPLEMENT") {
    return {
      min: -(2 ** (enc.sizeInBits - 1)),
      max: 2 ** (enc.sizeInBits - 1) - 1,
    };
  }
  return { min: 0, max: 2 ** enc.sizeInBits - 1 };
};

const makeIntField = (min: number, max: number, dataMode: string) =>
  Effect.gen(function* () {
    const range = max - min + 1;
    const ref = yield* Ref.make(0);

    return dataMode === "random"
      ? Effect.sync(() => Math.floor(Math.random() * range) + min)
      : Ref.getAndUpdate(ref, (n) => (n + 1) % range).pipe(
          Effect.map((n) => n + min),
        );
  });

const makeFloatField = (sizeInBits: number, dataMode: string) =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(0);

    // Sensible default ranges by size — adjust per domain as needed
    const min = sizeInBits === 64 ? -1e6 : -1e3;
    const max = sizeInBits === 64 ? 1e6 : 1e3;
    const step = sizeInBits === 64 ? 0.001 : 0.1;
    const steps = Math.floor((max - min) / step);

    return dataMode === "random"
      ? Effect.sync(() => Math.random() * (max - min) + min)
      : Ref.getAndUpdate(ref, (n) => (n + 1) % steps).pipe(
          Effect.map((n) => n * step + min),
        );
  });

export class DataGenerator extends ServiceMap.Service<
  DataGenerator,
  {
    /** Create a number generator for a specific integer range */
    readonly forRange: (
      min: number,
      max: number,
    ) => Effect.Effect<Effect.Effect<number>>;
    /** Create a number generator derived from a data encoding spec */
    readonly forEncoding: (
      enc: DataEncoding,
    ) => Effect.Effect<Effect.Effect<number>>;
  }
>()("@mrt/simulator/DataGenerator") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const dataMode = yield* DATA_MODE;

      const forRange = (min: number, max: number) =>
        makeIntField(min, max, dataMode);

      const forEncoding = (enc: DataEncoding) => {
        switch (enc.type) {
          case "INTEGER":
            return makeIntField(intRange(enc).min, intRange(enc).max, dataMode);
          case "FLOAT":
            return makeFloatField(enc.sizeInBits, dataMode);
        }
      };

      return { forRange, forEncoding };
    }),
  );
}
