import test from "node:test";
import assert from "node:assert/strict";
import { SEMANTIC_DRAFT_SCHEMA } from "../dist/src/semantic-draft.js";

function assertStrictObjects(node, path = "#") {
  if (!node || typeof node !== "object") return;

  if (node.type === "object" && node.properties) {
    const keys = Object.keys(node.properties).sort();
    const required = [...(node.required ?? [])].sort();
    assert.deepEqual(required, keys, `${path} must require every declared property`);
  }

  if (node.properties) {
    for (const [key, value] of Object.entries(node.properties)) {
      assertStrictObjects(value, `${path}/properties/${key}`);
    }
  }
  if (node.items) assertStrictObjects(node.items, `${path}/items`);
  for (const [index, value] of (node.anyOf ?? []).entries()) {
    assertStrictObjects(value, `${path}/anyOf/${index}`);
  }
}

test("semantic draft schema stays strict-output compatible", () => {
  assertStrictObjects(SEMANTIC_DRAFT_SCHEMA);
});
