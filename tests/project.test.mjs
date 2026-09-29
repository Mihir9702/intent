import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";
import { applyInheritedPolicies } from "../dist/src/project.js";
import { validateIntent } from "../dist/src/validator.js";

test("inherits project policy without importing project goals", () => {
  const policy = parseIntent(
    "INV{history.rewrite=never}\nC{permissions.enforcement=server_side}\nG{policy.example_only}",
    "project.intent"
  );
  const task = parseIntent(
    "G{history.rewrite=allow}\nV{tests}\nDONE{tests=pass}",
    "task.intent"
  );
  const merged = applyInheritedPolicies(task, [policy]);

  assert.equal(merged.statements.some((s) =>
    s.propositions.some((p) => p.path === "policy.example_only")), false);
  assert.equal(merged.statements[0].source, "project.intent");

  const result = validateIntent(merged);
  const conflict = result.diagnostics.find((d) => d.code === "E201");
  assert.equal(result.ok, false);
  assert.equal(conflict?.source, "task.intent");
  assert.equal(conflict?.relatedSource, "project.intent");
});
