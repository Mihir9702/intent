import test from "node:test";
import assert from "node:assert/strict";
import {
  extractClaudeStructuredOutput
} from "../dist/src/frontends/claude.js";
import { buildSemanticParsingPrompt } from "../dist/src/frontends/prompt.js";

const draft = { statements: [], unresolved: [], notes: [] };

test("extracts Claude structured output envelope", () => {
  assert.deepEqual(
    extractClaudeStructuredOutput(JSON.stringify({ structured_output: draft })),
    draft
  );
  assert.deepEqual(
    extractClaudeStructuredOutput(JSON.stringify({ result: JSON.stringify(draft) })),
    draft
  );
});

test("semantic prompt forbids requirement invention and numbers source lines", () => {
  const prompt = buildSemanticParsingPrompt({
    text: "First line\nDelete the old document",
    source: "task.txt"
  });
  assert.match(prompt, /Do not invent tests/);
  assert.match(prompt, /Actions MUST be represented as canonical entities \+ operations/);
  assert.match(prompt, /Do not emit goal statements/);
  assert.match(prompt, /depends_on operation ids/);
  assert.match(prompt, /multiple plausible bindings/);
  assert.match(prompt, /2: Delete the old document/);
});
