import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";
import { validateIntent } from "../dist/src/validator.js";

test("accepts a coherent program", () => {
  const result = validateIntent(parseIntent(`G{x.change}\nINV{history.rewrite=never}\nV{tests}\nDONE{tests=pass}`));
  assert.equal(result.ok, true);
});

test("blocks a goal that directly violates an invariant", () => {
  const result = validateIntent(parseIntent(`G{history.rewrite=allow}\nINV{history.rewrite=never}\nV{tests}\nDONE{tests=pass}`));
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((d) => d.code === "E201"), true);
});

test("warns when verification and completion conditions are absent", () => {
  const result = validateIntent(parseIntent(`G{x.change}`));
  assert.equal(result.ok, true);
  const codes = result.diagnostics.map((d) => d.code);
  assert.equal(codes.includes("W102"), true);
  assert.equal(codes.includes("W103"), true);
});
