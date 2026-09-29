import test from "node:test";
import assert from "node:assert/strict";
import { parseIntentJson } from "../dist/src/json.js";
import { validateIntent } from "../dist/src/validator.js";

test("loads canonical Intent JSON with typed operations", () => {
  const program = parseIntentJson(JSON.stringify({
    version: "0.3",
    statements: [],
    semantics: {
      ontology: "intent-core/0.1",
      entities: [
        { id: "old_document", kind: "document", resolution: "resolved" },
        { id: "corrected_version", kind: "document", resolution: "resolved" }
      ],
      operations: [{
        id: "replace_document",
        kind: "replace",
        target: "old_document",
        arguments: [{ role: "with", entity: "corrected_version" }],
        dependsOn: []
      }]
    }
  }));

  assert.equal(program.semantics.operations[0].kind, "replace");
  assert.equal(validateIntent(program).ok, true);
});

test("rejects structurally malformed canonical JSON", () => {
  assert.throws(
    () => parseIntentJson(JSON.stringify({
      version: "0.3",
      statements: [],
      semantics: {
        ontology: "intent-core/0.1",
        entities: [],
        operations: [{
          id: "bad",
          kind: "delete",
          arguments: []
        }]
      }
    })),
    /dependsOn/
  );
});
