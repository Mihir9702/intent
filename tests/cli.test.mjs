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

test("cli: --help exits with code 0", async () => {
  const { stdout } = await exec(node, [cli, "--help"]);
  assert.match(stdout, /Usage:/);
});

test("cli: accepts flags before positional file argument", async () => {
  const { stdout } = await exec(node, [
    cli,
    "validate",
    "--inherit",
    "examples/project.intent",
    "examples/customer-po.intent"
  ]);
  assert.match(stdout, /PASS — no diagnostics/);
});

test("cli: errors when flag argument is missing value", async () => {
  let failed = false;
  try {
    await exec(node, [cli, "compile", "examples/canonical-replace.intent.json", "--target"]);
  } catch (err) {
    failed = true;
    assert.equal(err.code, 1);
    assert.match(err.stdout, /missing argument value for '--target'/);
  }
  assert.equal(failed, true, "expected error on missing flag value");
});

test("cli: diff computes semantic AST delta between programs", async () => {
  const { stdout } = await exec(node, [
    cli,
    "diff",
    "examples/canonical-replace.intent.json",
    "examples/ambiguous-replace-delete.intent.json"
  ]);
  assert.match(stdout, /INTENT SEMANTIC AST DIFF/);
  assert.match(stdout, /@old_one/);
  assert.match(stdout, /\[delete_old\]/);
});

test("cli: diff --json outputs structured diff", async () => {
  const { stdout } = await exec(node, [
    cli,
    "diff",
    "examples/canonical-replace.intent.json",
    "examples/ambiguous-replace-delete.intent.json",
    "--json"
  ]);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.identical, false);
  assert.equal(parsed.entities.some((e) => e.id === "old_one"), true);
});

test("cli: verify validates execution evidence against intent specification", async () => {
  const { stdout } = await exec(node, [
    cli,
    "verify",
    "examples/canonical-replace.intent.json",
    "--evidence",
    "examples/evidence-verified.json"
  ]);
  assert.match(stdout, /INTENT INDEPENDENT VERIFICATION REPORT/);
  assert.match(stdout, /VERIFIED \(ALL CHECKS PASSED\)/);
  assert.match(stdout, /Verification Certificate:/);
});

test("cli: verify detects policy violations in evidence and exits with code 1", async () => {
  let failed = false;
  try {
    await exec(node, [
      cli,
      "verify",
      "examples/canonical-replace.intent.json",
      "--inherit",
      "examples/project.intent",
      "--evidence",
      "examples/evidence-violated.json"
    ]);
  } catch (err) {
    failed = true;
    assert.equal(err.code, 1);
    assert.match(err.stdout, /FAILED \/ INCOMPLETE/);
    assert.match(err.stdout, /INV-001/);
  }
  assert.equal(failed, true, "expected verification failure on violated evidence");
});

test("cli: supervise executes child process and runs live evidence verification", async () => {
  let failed = false;
  try {
    const { stdout } = await exec(node, [
      cli,
      "supervise",
      "examples/canonical-replace.intent.json",
      "--",
      node,
      "-e",
      "console.log('supervised-run');"
    ]);
    assert.match(stdout, /supervised-run/);
    assert.match(stdout, /INTENT INDEPENDENT VERIFICATION REPORT/);
  } catch (err) {
    // Exits with code 1 if incomplete, which is expected since canonical-replace requires reviewed semantics
    assert.equal(err.code, 1);
    assert.match(err.stdout, /supervised-run/);
    assert.match(err.stdout, /INTENT INDEPENDENT VERIFICATION REPORT/);
  }
});



