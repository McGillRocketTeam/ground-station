import { BitStream, BitView } from "bit-buffer";
import { Effect } from "effect";

import type { Container, DataEncoding } from "./Container.ts";

import { DataGenerator } from "./DataGenerator.ts";

type ResolvedField = {
  offset: number;
  encoding: DataEncoding;
  generator: Effect.Effect<number>;
};

const writeField = (
  buffer: Buffer,
  stream: BitStream,
  field: ResolvedField,
  value: number,
) => {
  const { offset, encoding } = field;
  stream.index = offset;
  stream.bigEndian = !encoding.littleEndian;

  switch (encoding.type) {
    case "INTEGER":
      stream.writeBits(value, encoding.sizeInBits);
      break;
    case "FLOAT": {
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
      // Advance the stream index past the float
      stream.index = offset + encoding.sizeInBits;
      break;
    }
  }
};

/**
 * Takes a container definition and returns an Effect that,
 * each time it runs, produces a fresh binary packet with
 * generated values.
 */
export const makePacketBuilder = (container: Container) =>
  Effect.gen(function* () {
    const gen = yield* DataGenerator;

    const fields: Array<ResolvedField> = [];
    let cursor = 0;

    for (const entry of container.entry) {
      const offset =
        entry.referenceLocation === "CONTAINER_START"
          ? entry.locationInBits
          : cursor + entry.locationInBits;

      const encoding = entry.parameter.type.dataEncoding;
      const generator = yield* gen.forEncoding(encoding);

      fields.push({ offset, encoding, generator });
      cursor = offset + encoding.sizeInBits;
    }

    const totalBytes = Math.ceil(cursor / 8);

    return Effect.gen(function* () {
      const buffer = Buffer.alloc(totalBytes);
      const view = new BitView(buffer);
      const stream = new BitStream(view);

      for (const field of fields) {
        const value = yield* field.generator;
        writeField(buffer, stream, field, value);
      }

      return buffer;
    });
  });
