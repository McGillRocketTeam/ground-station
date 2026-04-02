import { BitStream, BitView } from "bit-buffer";
import { Effect } from "effect";

import type {
  Container,
  ContainerEntry,
  DataEncoding,
  Parameter,
} from "./Container.ts";

import { DataGenerator, type GeneratedFieldValue } from "./DataGenerator.ts";

type ResolvedField = {
  offset: number;
  encoding: DataEncoding;
  generator: Effect.Effect<GeneratedFieldValue, never, never>;
};

type ResolvedEntries = {
  fields: Array<ResolvedField>;
  cursor: number;
};

type NumberGeneratorFactory = {
  readonly forParameter: (
    parameter: Parameter,
  ) => Effect.Effect<
    Effect.Effect<GeneratedFieldValue, never, never>,
    never,
    never
  >;
};

const encodeIntegerValue = (
  encoding: Extract<DataEncoding, { type: "INTEGER" }>,
  value: number,
) => {
  if (encoding.encoding !== "TWOS_COMPLEMENT" || value >= 0) {
    return value;
  }

  return value + 2 ** encoding.sizeInBits;
};

const writeField = (
  buffer: Buffer,
  stream: BitStream,
  field: ResolvedField,
  value: GeneratedFieldValue,
) => {
  const { offset, encoding } = field;
  stream.index = offset;
  stream.bigEndian = !encoding.littleEndian;

  switch (encoding.type) {
    case "INTEGER":
      if (typeof value !== "number") {
        throw new TypeError(
          `Expected numeric value for ${encoding.type} field`,
        );
      }
      stream.writeBits(
        encodeIntegerValue(encoding, value),
        encoding.sizeInBits,
      );
      break;
    case "FLOAT": {
      if (typeof value !== "number") {
        throw new TypeError(
          `Expected numeric value for ${encoding.type} field`,
        );
      }
      const byteOffset = offset / 8;
      if (encoding.sizeInBits === 64) {
        // oxlint-disable-next-line no-unused-expressions
        encoding.littleEndian
          ? buffer.writeDoubleLE(value, byteOffset)
          : buffer.writeDoubleBE(value, byteOffset);
      } else {
        // oxlint-disable-next-line no-unused-expressions
        encoding.littleEndian
          ? buffer.writeFloatLE(value, byteOffset)
          : buffer.writeFloatBE(value, byteOffset);
      }
      stream.index = offset + encoding.sizeInBits;
      break;
    }
    case "STRING": {
      const byteOffset = offset / 8;
      const byteLength = Math.floor(encoding.sizeInBits / 8);
      const bytes = Buffer.from(String(value), "ascii");

      buffer.fill(0, byteOffset, byteOffset + byteLength);
      bytes.copy(buffer, byteOffset, 0, byteLength);
      stream.index = offset + encoding.sizeInBits;
      break;
    }
  }
};

const resolveEntries = (
  entries: ReadonlyArray<ContainerEntry>,
  startOffset: number,
  gen: NumberGeneratorFactory,
): Effect.Effect<ResolvedEntries, never, never> =>
  Effect.gen(function* () {
    const fields: Array<ResolvedField> = [];
    let cursor = startOffset;

    for (const entry of entries) {
      const offset =
        entry.referenceLocation === "CONTAINER_START"
          ? startOffset + entry.locationInBits
          : cursor + entry.locationInBits;

      if (entry.parameter) {
        const encoding = entry.parameter.type.dataEncoding;
        const generator = yield* gen.forParameter(entry.parameter);

        fields.push({ offset, encoding, generator });
        cursor = Math.max(cursor, offset + encoding.sizeInBits);
        continue;
      }

      if (entry.container) {
        const resolved = yield* resolveEntries(
          entry.container.entry,
          offset,
          gen,
        );
        fields.push(...resolved.fields);
        cursor = Math.max(cursor, resolved.cursor);
      }
    }

    return { fields, cursor };
  });

export const makePacketBuilder = (
  container: Container,
): Effect.Effect<Effect.Effect<Buffer, never, never>, never, DataGenerator> =>
  Effect.gen(function* () {
    const gen = yield* DataGenerator;

    const { fields, cursor } = yield* resolveEntries(container.entry, 0, gen);

    const totalBytes = Math.ceil(cursor / 8);

    return yield* Effect.succeed(
      Effect.gen(function* () {
        const buffer = Buffer.alloc(totalBytes);
        const view = new BitView(buffer);
        const stream = new BitStream(view);

        for (const field of fields) {
          const value = yield* field.generator;
          writeField(buffer, stream, field, value);
        }

        return buffer;
      }),
    );
  });
