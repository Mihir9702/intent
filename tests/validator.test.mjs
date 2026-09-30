import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";
import { validateIntent } from "../dist/src/validator.js";
import { CORE_ONTOLOGY } from "../dist/src/ontology/model.js";

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

test("blocks a canonical operation that mutates an invariant-protected entity (E202)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "invariant",
        propositions: [{ path: "historical_documents.mutable", value: false, raw: "historical_documents.mutable=false" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "audit.verified", raw: "audit.verified" }],
        line: 2
      },
      {
        kind: "done",
        propositions: [{ path: "tests", value: "pass", raw: "tests=pass" }],
        line: 3
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        {
          id: "doc1",
          kind: "document",
          type: "archive.historical_documents",
          resolution: "resolved"
        }
      ],
      operations: [
        {
          id: "update_doc",
          kind: "update",
          target: "doc1",
          arguments: [],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E202");
  assert.ok(err, "expected E202 diagnostic");
  assert.match(err.message, /operation 'update_doc' \(update\) violates invariant 'historical_documents\.mutable=false' on target 'doc1'/);
});

test("blocks a canonical operation that deletes an entity protected by rewrite/delete invariant (E202)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "invariant",
        propositions: [{ path: "financial_history.rewrite", value: "never", raw: "financial_history.rewrite=never" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "check", raw: "check" }],
        line: 2
      },
      {
        kind: "done",
        propositions: [{ path: "tests", value: "pass", raw: "tests=pass" }],
        line: 3
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        {
          id: "financial_history",
          kind: "record",
          resolution: "resolved"
        }
      ],
      operations: [
        {
          id: "delete_history",
          kind: "delete",
          target: "financial_history",
          arguments: [],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((d) => d.code === "E202"), true);
});

test("allows read-only canonical operations (observe) on invariant-protected entities", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "invariant",
        propositions: [{ path: "historical_documents.mutable", value: false, raw: "historical_documents.mutable=false" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "audit.verified", raw: "audit.verified" }],
        line: 2
      },
      {
        kind: "done",
        propositions: [{ path: "tests", value: "pass", raw: "tests=pass" }],
        line: 3
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        {
          id: "doc1",
          kind: "document",
          type: "archive.historical_documents",
          resolution: "resolved"
        }
      ],
      operations: [
        {
          id: "inspect_doc",
          kind: "observe",
          target: "doc1",
          arguments: [],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.some((d) => d.code === "E202"), false);
});
