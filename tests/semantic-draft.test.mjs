import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSemanticDraft } from "../dist/src/semantic-draft.js";
import { validateIntent } from "../dist/src/validator.js";

test("normalizes model draft with source provenance", () => {
  const draft = {
    statements: [{
      kind: "goal",
      propositions: [{ path: "invoice.fix", has_value: false, value: null }],
      confidence: null,
      source_line: 2
    }],
    unresolved: [],
    notes: ["parser note"]
  };

  const result = normalizeSemanticDraft(draft, "Context\nFix the invoice", "task.txt");
  assert.equal(result.program.version, "0.2");
  assert.equal(result.program.statements[0].source, "task.txt");
  assert.equal(result.program.statements[0].line, 2);
  assert.deepEqual(result.notes, ["parser note"]);
});

test("rejects invented source lines outside the source text", () => {
  const draft = {
    statements: [{
      kind: "goal",
      propositions: [{ path: "x", has_value: false, value: null }],
      confidence: null,
      source_line: 9
    }],
    unresolved: [],
    notes: []
  };
  assert.throws(() => normalizeSemanticDraft(draft, "one line", "task.txt"), /outside the input text/);
});
