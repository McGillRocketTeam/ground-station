import { Effect, Layer, Ref, Context } from "effect";

import type { DataEncoding, Parameter } from "./Container.ts";

import { DATA_MODE } from "./Config.ts";

export type GeneratedFieldValue = number | string;

const intRange = (enc: DataEncoding & { type: "INTEGER" }) => {
  if (enc.encoding === "TWOS_COMPLEMENT") {
    return {
      min: -(2 ** (enc.sizeInBits - 1)),
      max: 2 ** (enc.sizeInBits - 1) - 1,
    };
  }
  return { min: 0, max: 2 ** enc.sizeInBits - 1 };
};

const makeIntField = (
  min: number,
  max: number,
  dataMode: string,
): Effect.Effect<
  Effect.Effect<GeneratedFieldValue, never, never>,
  never,
  never
> =>
  Ref.make(0).pipe(
    Effect.map((ref) => {
      const range = max - min + 1;

      return dataMode === "random"
        ? Effect.sync(() => Math.floor(Math.random() * range) + min)
        : Ref.getAndUpdate(ref, (n) => (n + 1) % range).pipe(
            Effect.map((n) => n + min),
          );
    }),
  );

const makeFixedField = (
  value: GeneratedFieldValue,
): Effect.Effect<
  Effect.Effect<GeneratedFieldValue, never, never>,
  never,
  never
> => Effect.succeed(Effect.succeed(value));

const makeChoiceField = (
  values: ReadonlyArray<number>,
  dataMode: string,
): Effect.Effect<
  Effect.Effect<GeneratedFieldValue, never, never>,
  never,
  never
> =>
  Ref.make(0).pipe(
    Effect.map((ref) =>
      dataMode === "random"
        ? Effect.sync(
            () =>
              values[Math.floor(Math.random() * values.length)] ??
              values[0] ??
              0,
          )
        : Ref.getAndUpdate(ref, (n) => (n + 1) % values.length).pipe(
            Effect.map((n) => values[n] ?? values[0] ?? 0),
          ),
    ),
  );

const getEnumerationValues = (parameter: Parameter): ReadonlyArray<number> =>
  (parameter.type.enumValues ?? parameter.type.enumValue ?? []).flatMap(
    ({ value }) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) ? [parsed] : [];
    },
  );

const makeStringField = (
  label: string,
  sizeInBits: number,
  dataMode: string,
): Effect.Effect<
  Effect.Effect<GeneratedFieldValue, never, never>,
  never,
  never
> => {
  const byteLength = Math.max(1, Math.floor(sizeInBits / 8));
  const textLength = Math.max(1, byteLength - 1);
  const prefix = label
    .replaceAll(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, Math.min(2, textLength));
  const suffixLength = Math.max(0, textLength - prefix.length);

  return Ref.make(0).pipe(
    Effect.map((ref) =>
      dataMode === "random"
        ? Effect.sync(() =>
            Array.from({ length: textLength }, () =>
              Math.random().toString(36).charAt(2).toUpperCase(),
            ).join(""),
          )
        : Ref.getAndUpdate(
            ref,
            (n) => (n + 1) % 10 ** Math.max(1, suffixLength),
          ).pipe(
            Effect.map((n) => {
              const suffix = suffixLength
                ? n.toString().padStart(suffixLength, "0")
                : "";
              return `${prefix}${suffix}`.slice(0, textLength);
            }),
          ),
    ),
  );
};

const makeFloatField = (
  sizeInBits: number,
  dataMode: string,
): Effect.Effect<
  Effect.Effect<GeneratedFieldValue, never, never>,
  never,
  never
> =>
  Ref.make(0).pipe(
    Effect.map((ref) => {
      const min = sizeInBits === 64 ? -1e6 : -1e3;
      const max = sizeInBits === 64 ? 1e6 : 1e3;
      const step = sizeInBits === 64 ? 0.001 : 0.1;
      const steps = Math.floor((max - min) / step);

      return dataMode === "random"
        ? Effect.sync(() => Math.random() * (max - min) + min)
        : Ref.getAndUpdate(ref, (n) => (n + 1) % steps).pipe(
            Effect.map((n) => n * step + min),
          );
    }),
  );

export class DataGenerator extends Context.Service<
  DataGenerator,
  {
    /** Create a number generator derived from a parameter definition */
    readonly forParameter: (
      parameter: Parameter,
    ) => Effect.Effect<
      Effect.Effect<GeneratedFieldValue, never, never>,
      never,
      never
    >;
  }
>()("@mrt/simulator/DataGenerator") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const dataMode = yield* DATA_MODE;

      const forEncoding = (enc: DataEncoding) => {
        switch (enc.type) {
          case "INTEGER":
            return makeIntField(intRange(enc).min, intRange(enc).max, dataMode);
          case "FLOAT":
            return makeFloatField(enc.sizeInBits, dataMode);
          case "STRING":
            return makeStringField("TM", enc.sizeInBits, dataMode);
        }
      };

      const forParameter = (parameter: Parameter) => {
        if (parameter.name.endsWith("_atomic_flag")) {
          return makeFixedField(1);
        }

        switch (parameter.type.engType) {
          case "boolean":
            return makeChoiceField([0, 1], dataMode);
          case "enumeration": {
            const values = getEnumerationValues(parameter);
            if (values.length > 0) {
              return makeChoiceField(values, dataMode);
            }
            return forEncoding(parameter.type.dataEncoding);
          }
          case "string":
            return makeStringField(
              parameter.name,
              parameter.type.dataEncoding.sizeInBits,
              dataMode,
            );
          default:
            return forEncoding(parameter.type.dataEncoding);
        }
      };

      return { forParameter };
    }),
  );
}
