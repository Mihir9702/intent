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

test("blocks conflicting constraints on the same proposition path (E117)", () => {
  const result = validateIntent(
    parseIntent("C{permission.enforce=server_side}\nC{permission.enforce=client_side}\nV{tests}\nDONE{tests=pass}")
  );
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E117");
  assert.ok(err, "expected E117 diagnostic on conflicting constraints");
  assert.match(err.message, /conflicting constraint for 'permission\.enforce'/);
});

test("blocks bare goal proposition that violates an invariant (E201)", () => {
  const result = validateIntent(
    parseIntent("G{financial_history.rewrite}\nINV{financial_history.rewrite=never}\nV{tests}\nDONE{tests=pass}")
  );
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E201");
  assert.ok(err, "expected E201 diagnostic on bare goal violating invariant");
});

test("blocks operation when an entity argument is protected by invariant (E202 on related)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "invariant",
        propositions: [{ path: "audit_log.mutable", value: false, raw: "audit_log.mutable=false" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "v", raw: "v" }],
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
        { id: "order", kind: "record", resolution: "resolved" },
        { id: "audit_log", kind: "record", resolution: "resolved" }
      ],
      operations: [
        {
          id: "unlink_audit",
          kind: "unlink",
          target: "order",
          arguments: [{ role: "related", entity: "audit_log" }],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E202");
  assert.ok(err, "expected E202 on unlinked argument");
  assert.match(err.message, /on related 'audit_log'/);
});

test("rejects executing a non-executable entity kind like document (E417)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "verification",
        propositions: [{ path: "v", raw: "v" }],
        line: 1
      },
      {
        kind: "done",
        propositions: [{ path: "tests", value: "pass", raw: "tests=pass" }],
        line: 2
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "my_doc", kind: "document", resolution: "resolved" }
      ],
      operations: [
        {
          id: "exec_doc",
          kind: "execute",
          target: "my_doc",
          arguments: [],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E417");
  assert.ok(err, "expected E417 when executing document");
});

test("blocks delete operation when universal wildcard invariant *.delete=never is present (E202)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "invariant",
        propositions: [{ path: "*.delete", value: "never", raw: "*.delete=never" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "v", raw: "v" }],
        line: 2
      },
      {
        kind: "done",
        propositions: [{ path: "d", raw: "d" }],
        line: 3
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "some_temp_file", kind: "file", resolution: "resolved" }
      ],
      operations: [
        {
          id: "delete_file",
          kind: "delete",
          target: "some_temp_file",
          arguments: [],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E202");
  assert.ok(err, "expected E202 when wildcard invariant matches");
  assert.match(err.message, /violates invariant '\*\.delete=never'/);
});

test("blocks operation when operational constraint forbids action (E203)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "constraint",
        propositions: [{ path: "invoiced_line.action", value: "refuse", raw: "invoiced_line.action=refuse" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "v", raw: "v" }],
        line: 2
      },
      {
        kind: "done",
        propositions: [{ path: "d", raw: "d" }],
        line: 3
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "invoiced_line", kind: "record", resolution: "resolved" }
      ],
      operations: [
        {
          id: "update_line",
          kind: "update",
          target: "invoiced_line",
          arguments: [],
          dependsOn: []
        }
      ]
    }
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E203");
  assert.ok(err, "expected E203 on constraint violation");
  assert.match(err.message, /violates constraint 'invoiced_line\.action=refuse'/);
});

test("blocks goal that directly violates an operational constraint (E204)", () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "constraint",
        propositions: [{ path: "auth.enabled", value: false, raw: "auth.enabled=false" }],
        line: 1
      },
      {
        kind: "goal",
        propositions: [{ path: "auth.enabled", value: true, raw: "auth.enabled=true" }],
        line: 2
      },
      {
        kind: "verification",
        propositions: [{ path: "v", raw: "v" }],
        line: 3
      },
      {
        kind: "done",
        propositions: [{ path: "d", raw: "d" }],
        line: 4
      }
    ]
  };

  const result = validateIntent(program);
  assert.equal(result.ok, false);
  const err = result.diagnostics.find((d) => d.code === "E204");
  assert.ok(err, "expected E204 on goal violating constraint");
});


