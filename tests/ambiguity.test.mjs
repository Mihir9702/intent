import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";
import { validateIntent } from "../dist/src/validator.js";
import { renderEnglish } from "../dist/src/renderers/english.js";
import { renderCompact } from "../dist/src/renderers/compact.js";

test("unresolved references block validation and stay visible", () => {
  const program = parseIntent("G{document.replace}\nV{tests}\nDONE{tests=pass}", "task.intent");
  program.unresolved = [{
    id: "A-001",
    text: "old document",
    candidates: ["database_record", "generated_pdf", "source_upload"],
    destructive: true,
    source: "task.txt",
    line: 1
  }];

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((d) => d.code === "E301"), true);
  assert.match(renderEnglish(program), /old document/);
  assert.match(renderEnglish(program), /database_record/);
  assert.throws(() => renderCompact(program), /unresolved references/);
});
