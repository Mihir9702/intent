import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("published Intent JSON schema matches v0.3 ontology", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schema/intent.schema.json", import.meta.url), "utf8")
  );

  assert.equal(schema.properties.version.const, "0.3");
  assert.equal(schema.properties.semantics.properties.ontology.const, "intent-core/0.1");

  const operation = schema.properties.semantics.properties.operations.items;
  assert.equal(operation.required.includes("dependsOn"), true);
  assert.equal(operation.properties.kind.enum.includes("replace"), true);
});

test("published semantic frontend schema requires canonical ontology fields", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schema/semantic-draft.schema.json", import.meta.url), "utf8")
  );

  assert.deepEqual(
    schema.required,
    ["entities", "operations", "statements", "unresolved", "notes"]
  );

  const operation = schema.properties.operations.items;
  assert.equal(operation.required.includes("depends_on"), true);
  assert.equal(operation.properties.kind.enum.includes("delete"), true);

  const statementKinds = schema.properties.statements.items.properties.kind.enum;
  assert.equal(statementKinds.includes("goal"), false);
});
