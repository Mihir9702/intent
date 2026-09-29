import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";

test("parses compact Intent into canonical AST", () => {
  const program = parseIntent(`G{CPO.remove_line}\nH{root_cause=legacy_guard}^.96\nINV{financial_history.rewrite=never}\nV{tests.integration}\nDONE{tests=pass}`);
  assert.equal(program.version, "0.3");
  assert.equal(program.statements.length, 5);
  assert.equal(program.statements[1].kind, "hypothesis");
  assert.equal(program.statements[1].confidence, 0.96);
  assert.deepEqual(program.statements[2].propositions[0], {
    path: "financial_history.rewrite",
    value: "never",
    raw: "financial_history.rewrite=never"
  });
});
