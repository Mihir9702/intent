import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const node = process.execPath;
const cli = "dist/src/cli.js";

test("cli: validate passes on canonical-replace.intent.json", async () => {
  const { stdout } = await exec(node, [cli, "validate", "examples/canonical-replace.intent.json"]);
  assert.match(stdout, /PASS — no diagnostics/);
});

test("cli: check alias works identically to validate", async () => {
  const { stdout } = await exec(node, [cli, "check", "examples/canonical-replace.intent.json"]);
  assert.match(stdout, /PASS — no diagnostics/);
});

test("cli: validate blocks ambiguous-replace-delete with E403", async () => {
  let failed = false;
  try {
    await exec(node, [cli, "validate", "examples/ambiguous-replace-delete.intent.json"]);
  } catch (err) {
    failed = true;
    assert.equal(err.code, 1);
    assert.match(err.stdout, /ERROR E403/);
    assert.match(err.stdout, /references unresolved entity 'old_one'/);
  }
  assert.equal(failed, true, "expected CLI validate to fail on ambiguous program");
});

test("cli: explain renders human-readable semantics", async () => {
  const { stdout } = await exec(node, [cli, "explain", "examples/canonical-replace.intent.json"]);
  assert.match(stdout, /Canonical entities/);
  assert.match(stdout, /@old_document <document>/);
  assert.match(stdout, /Canonical operations/);
  assert.match(stdout, /replace_document: replace @old_document \(with=@corrected_version\)/);
});

test("cli: compile --target claude produces structured XML", async () => {
  const { stdout } = await exec(node, [
    cli,
    "compile",
    "examples/canonical-replace.intent.json",
    "--target",
    "claude"
  ]);
  assert.match(stdout, /<intent version="0\.3">/);
  assert.match(stdout, /<canonical_semantics ontology="intent-core\/0\.1">/);
  assert.match(stdout, /<operation id="replace_document" kind="replace" target="old_document">/);
});

test("cli: compile --target codex produces execution Markdown", async () => {
  const { stdout } = await exec(node, [
    cli,
    "compile",
    "examples/canonical-replace.intent.json",
    "--target",
    "codex"
  ]);
  assert.match(stdout, /# Intent Execution Specification \(v0\.3\)/);
  assert.match(stdout, /\*\*Ontology\*\*: `intent-core\/0\.1`/);
  assert.match(stdout, /## Canonical Entities/);
  assert.match(stdout, /`@old_document` <`document`>/);
  assert.match(stdout, /## Operation Plan/);
  assert.match(stdout, /\*\*`\[replace_document\]`\*\* `replace` on `@old_document`/);
});

test("cli: compile --target json roundtrips canonical JSON", async () => {
  const { stdout } = await exec(node, [
    cli,
    "compile",
    "examples/canonical-replace.intent.json",
    "--target",
    "json"
  ]);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.version, "0.3");
  assert.equal(parsed.semantics.ontology, "intent-core/0.1");
  assert.equal(parsed.semantics.operations[0].id, "replace_document");
});

test("cli: validate with --inherit enforces project policy invariants", async () => {
  let failed = false;
  try {
    await exec(node, [
      cli,
      "validate",
      "examples/conflict.intent",
      "--inherit",
      "examples/project.intent"
    ]);
  } catch (err) {
    failed = true;
    assert.equal(err.code, 1);
    assert.match(err.stdout, /ERROR E201/);
    assert.match(err.stdout, /violates invariant/);
  }
  assert.equal(failed, true, "expected policy conflict to exit with code 1");
});
