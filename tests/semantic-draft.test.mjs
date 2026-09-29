import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSemanticDraft } from "../dist/src/semantic-draft.js";
import { validateIntent } from "../dist/src/validator.js";

function replaceDraft() {
  return {
    entities: [
      {
        id: "old_document",
        kind: "document",
        type: null,
        label: "the old document",
        resolution: "resolved",
        candidates: [],
        source_line: 2
      },
      {
        id: "corrected_version",
        kind: "document",
        type: null,
        label: "the corrected version",
        resolution: "resolved",
        candidates: [],
        source_line: 2
      }
    ],
    operations: [{
      id: "replace_document",
      kind: "replace",
      has_target: true,
      target: "old_document",
      arguments: [{
        role: "with",
        kind: "entity",
        entity: "corrected_version",
        value: null
      }],
      depends_on: [],
      source_line: 2
    }],
    statements: [{
      kind: "verification",
      propositions: [{ path: "replacement.verified", has_value: false, value: null }],
      confidence: null,
      source_line: 2
    }],
    unresolved: [],
    notes: ["parser note"]
  };
}

test("normalizes canonical operations with source provenance", () => {
  const result = normalizeSemanticDraft(
    replaceDraft(),
    "Context\nReplace the old document",
    "task.txt"
  );
  assert.equal(result.program.version, "0.3");
  assert.equal(result.program.semantics.ontology, "intent-core/0.1");
  assert.equal(result.program.semantics.operations[0].kind, "replace");
  assert.equal(result.program.semantics.operations[0].target, "old_document");
  assert.deepEqual(result.program.semantics.operations[0].arguments[0], {
    role: "with",
    entity: "corrected_version"
  });
  assert.equal(result.program.semantics.entities[0].source, "task.txt");
  assert.equal(result.program.statements[0].source, "task.txt");
  assert.deepEqual(result.notes, ["parser note"]);
  assert.equal(validateIntent(result.program).ok, true);
});

test("rejects operational goal statements from semantic frontends", () => {
  const draft = replaceDraft();
  draft.statements[0].kind = "goal";
  assert.throws(
    () => normalizeSemanticDraft(draft, "Context\nReplace the old document", "task.txt"),
    /invalid semantic statement kind/
  );
});

test("rejects invented source lines outside the source text", () => {
  const draft = replaceDraft();
  draft.operations[0].source_line = 9;
  assert.throws(
    () => normalizeSemanticDraft(draft, "one line", "task.txt"),
    /outside the input text/
  );
});

test("normalizes ambiguous entity bindings and blocks dependent deletion", () => {
  const draft = replaceDraft();
  draft.entities.push({
    id: "old_one",
    kind: "document",
    type: null,
    label: "the old one",
    resolution: "unresolved",
    candidates: [
      "original old document retained separately",
      "document at the replaced location"
    ],
    source_line: 2
  });
  draft.operations.push({
    id: "delete_old",
    kind: "delete",
    has_target: true,
    target: "old_one",
    arguments: [],
    depends_on: ["replace_document"],
    source_line: 2
  });

  const result = normalizeSemanticDraft(
    draft,
    "Context\nReplace the old document, then delete the old one",
    "task.txt"
  );
  const validation = validateIntent(result.program);

  assert.deepEqual(result.program.semantics.operations[1].dependsOn, ["replace_document"]);
  assert.equal(validation.diagnostics.some((d) => d.code === "E403"), true);
  assert.equal(validation.diagnostics.some((d) => d.code === "W101"), false);
});

test("rejects provider-invented operation roles before normalization", () => {
  const draft = replaceDraft();
  draft.operations[0].arguments[0].role = "source";
  assert.throws(
    () => normalizeSemanticDraft(draft, "Context\nReplace the old document", "task.txt"),
    /invalid argument role/
  );
});
