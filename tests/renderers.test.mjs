import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";
import { renderClaude } from "../dist/src/renderers/claude.js";
import { renderCompact } from "../dist/src/renderers/compact.js";

const program = parseIntent(`G{invoice.fix}\nINV{history.rewrite=never}\nV{pdf.snapshot}\nDONE{tests=pass}`);

test("renders Claude XML", () => {
  const output = renderClaude(program);
  assert.match(output, /<intent version="0\.2">/);
  assert.match(output, /<invariants>/);
  assert.match(output, /history\.rewrite = &quot;never&quot;|history\.rewrite = "never"/);
});

test("round-trips through compact syntax", () => {
  const reparsed = parseIntent(renderCompact(program));
  assert.deepEqual(reparsed.statements.map((s) => s.kind), program.statements.map((s) => s.kind));
});
