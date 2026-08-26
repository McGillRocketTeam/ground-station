import { Schema } from "effect";
import assert from "node:assert/strict";
import test from "node:test";

import { Value } from "../dist/schema.js";

test("decodes and encodes nested Yamcs aggregate arrays", () => {
  const wireValue = {
    type: "ARRAY",
    arrayValue: [
      {
        type: "AGGREGATE",
        aggregateValue: {
          name: ["port", "link_status", "clients"],
          value: [
            { type: "UINT32", uint32Value: 5 },
            { type: "ENUMERATED", stringValue: "UP", sint64Value: "1" },
            {
              type: "ARRAY",
              arrayValue: [{ type: "STRING", stringValue: "Omada Controller" }],
            },
          ],
        },
      },
    ],
  };

  const decoded = Schema.decodeUnknownSync(Value)(wireValue);
  assert.equal(decoded.type, "ARRAY");
  assert.deepEqual(decoded.value[0], {
    type: "AGGREGATE",
    value: {
      port: { type: "UINT32", value: 5 },
      link_status: { type: "ENUMERATED", value: "UP" },
      clients: { type: "ARRAY", value: [{ type: "STRING", value: "Omada Controller" }] },
    },
  });
  assert.deepEqual(Schema.encodeSync(Value)(decoded), {
    type: "ARRAY",
    arrayValue: [
      {
        type: "AGGREGATE",
        aggregateValue: {
          name: ["port", "link_status", "clients"],
          value: [
            { type: "UINT32", uint32Value: 5 },
            { type: "ENUMERATED", stringValue: "UP" },
            {
              type: "ARRAY",
              arrayValue: [{ type: "STRING", stringValue: "Omada Controller" }],
            },
          ],
        },
      },
    ],
  });
});

test("rejects aggregate payloads with mismatched member names and values", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(Value)({
      type: "AGGREGATE",
      aggregateValue: {
        name: ["port"],
        value: [],
      },
    }),
  );
});
