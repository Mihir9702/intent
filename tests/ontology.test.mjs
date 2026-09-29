import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ONTOLOGY } from "../dist/src/ontology/model.js";
import { typeCheckSemantics } from "../dist/src/ontology/typechecker.js";

function baseEntities() {
  return [
    { id: "old_document", kind: "document", resolution: "resolved" },
    { id: "corrected_version", kind: "document", resolution: "resolved" }
  ];
}

test("accepts canonical replace(target, with)", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: baseEntities(),
    operations: [{
      id: "replace_document",
      kind: "replace",
      target: "old_document",
      arguments: [{ role: "with", entity: "corrected_version" }],
      dependsOn: []
    }]
  });
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error"), []);
});

test("blocks unresolved entities referenced by destructive operations", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: [{
      id: "old_one",
      kind: "document",
      resolution: "unresolved",
      candidates: ["original_document", "document_at_location"]
    }],
    operations: [{
      id: "delete_old",
      kind: "delete",
      target: "old_one",
      arguments: [],
      dependsOn: []
    }]
  });
  assert.equal(diagnostics.some((d) => d.code === "E403"), true);
});

test("requires replace.with", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: baseEntities(),
    operations: [{
      id: "replace_document",
      kind: "replace",
      target: "old_document",
      arguments: [],
      dependsOn: []
    }]
  });
  assert.equal(diagnostics.some((d) => d.code === "E414"), true);
});

test("rejects incompatible replacement entity types", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: [
      { id: "invoice", kind: "record", type: "adiya.invoice", resolution: "resolved" },
      { id: "pdf", kind: "file", type: "application.pdf", resolution: "resolved" }
    ],
    operations: [{
      id: "replace_invoice",
      kind: "replace",
      target: "invoice",
      arguments: [{ role: "with", entity: "pdf" }],
      dependsOn: []
    }]
  });
  assert.equal(diagnostics.some((d) => d.code === "E415"), true);
});

test("rejects provider-invented argument roles", () => {
  const semantics = {
    ontology: CORE_ONTOLOGY,
    entities: baseEntities(),
    operations: [{
      id: "replace_document",
      kind: "replace",
      target: "old_document",
      arguments: [{ role: "source", entity: "corrected_version" }],
      dependsOn: []
    }]
  };
  const diagnostics = typeCheckSemantics(semantics);
  assert.equal(diagnostics.some((d) => d.code === "E409"), true);
});

test("preserves and validates operation ordering", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: [
      ...baseEntities(),
      {
        id: "old_one",
        kind: "document",
        resolution: "resolved"
      }
    ],
    operations: [
      {
        id: "replace_document",
        kind: "replace",
        target: "old_document",
        arguments: [{ role: "with", entity: "corrected_version" }],
        dependsOn: []
      },
      {
        id: "delete_old",
        kind: "delete",
        target: "old_one",
        arguments: [],
        dependsOn: ["replace_document"]
      }
    ]
  });
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error"), []);
});

test("rejects unknown operation dependencies", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: baseEntities(),
    operations: [{
      id: "replace_document",
      kind: "replace",
      target: "old_document",
      arguments: [{ role: "with", entity: "corrected_version" }],
      dependsOn: ["missing_operation"]
    }]
  });
  assert.equal(diagnostics.some((d) => d.code === "E425"), true);
});

test("rejects operation dependency cycles", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: baseEntities(),
    operations: [
      {
        id: "first",
        kind: "observe",
        target: "old_document",
        arguments: [],
        dependsOn: ["second"]
      },
      {
        id: "second",
        kind: "observe",
        target: "corrected_version",
        arguments: [],
        dependsOn: ["first"]
      }
    ]
  });
  assert.equal(diagnostics.some((d) => d.code === "E426"), true);
});

test("requires namespaced domain entity types", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: [{
      id: "invoice",
      kind: "record",
      type: "invoice",
      resolution: "resolved"
    }],
    operations: []
  });
  assert.equal(diagnostics.some((d) => d.code === "E427"), true);
});

test("warns when replacement subtype compatibility cannot be proven", () => {
  const diagnostics = typeCheckSemantics({
    ontology: CORE_ONTOLOGY,
    entities: [
      { id: "invoice", kind: "record", type: "adiya.invoice", resolution: "resolved" },
      { id: "replacement", kind: "record", resolution: "resolved" }
    ],
    operations: [{
      id: "replace_invoice",
      kind: "replace",
      target: "invoice",
      arguments: [{ role: "with", entity: "replacement" }],
      dependsOn: []
    }]
  });
  assert.equal(diagnostics.some((d) => d.code === "W402"), true);
  assert.equal(diagnostics.some((d) => d.code === "E415"), false);
});
