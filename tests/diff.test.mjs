import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ONTOLOGY } from "../dist/src/ontology/model.js";
import { diffPrograms, formatProgramDiff } from "../dist/src/diff.js";

test("diff: returns identical=true for identical programs", () => {
  const p1 = {
    version: "0.3",
    statements: [{ kind: "goal", propositions: [{ path: "task.run", raw: "task.run" }], line: 1 }],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [{ id: "doc", kind: "document", resolution: "resolved" }],
      operations: [{ id: "op1", kind: "observe", target: "doc", arguments: [], dependsOn: [] }]
    }
  };
  const diff = diffPrograms(p1, p1);
  assert.equal(diff.identical, true);
  assert.equal(diff.breaking, false);
  assert.equal(formatProgramDiff(diff), "No semantic differences between programs.");
});

test("diff: detects added, removed, and modified entities", () => {
  const p1 = {
    version: "0.3",
    statements: [],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "e1", kind: "document", resolution: "resolved" },
        { id: "e2", kind: "record", type: "accounting.invoice", resolution: "resolved" }
      ],
      operations: []
    }
  };

  const p2 = {
    version: "0.3",
    statements: [],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "e2", kind: "record", type: "accounting.invoice.vat", resolution: "resolved" },
        { id: "e3", kind: "file", resolution: "resolved" }
      ],
      operations: []
    }
  };

  const diff = diffPrograms(p1, p2);
  assert.equal(diff.identical, false);
  assert.equal(diff.entities.some((e) => e.id === "e1" && e.type === "removed"), true);
  assert.equal(diff.entities.some((e) => e.id === "e3" && e.type === "added"), true);
  assert.equal(diff.entities.some((e) => e.id === "e2" && e.type === "modified"), true);
});

test("diff: detects breaking policy modifications", () => {
  const p1 = {
    version: "0.3",
    statements: [
      { kind: "invariant", propositions: [{ path: "db.delete", value: "allow", raw: "db.delete=allow" }], line: 1 }
    ]
  };

  const p2 = {
    version: "0.3",
    statements: [
      { kind: "invariant", propositions: [{ path: "db.delete", value: "never", raw: "db.delete=never" }], line: 1 }
    ]
  };

  const diff = diffPrograms(p1, p2);
  assert.equal(diff.identical, false);
  assert.equal(diff.breaking, true);
  assert.match(formatProgramDiff(diff), /POTENTIALLY BREAKING CHANGES DETECTED/);
  assert.match(formatProgramDiff(diff), /policy changed for 'db\.delete'/);
});
