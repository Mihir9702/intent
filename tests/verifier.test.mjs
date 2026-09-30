import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ONTOLOGY } from "../dist/src/ontology/model.js";
import { verifyEvidence, formatVerificationReport } from "../dist/src/verifier.js";

function baseProgram() {
  return {
    version: "0.3",
    statements: [
      {
        kind: "invariant",
        propositions: [{ path: "database.delete", value: "never", raw: "database.delete=never" }],
        line: 1
      },
      {
        kind: "verification",
        propositions: [{ path: "test_suite.status", value: "passing", raw: "test_suite.status=passing" }],
        line: 2
      },
      {
        kind: "done",
        propositions: [{ path: "migration.completed", value: true, raw: "migration.completed=true" }],
        line: 3
      }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "database", kind: "system", resolution: "resolved" }
      ],
      operations: []
    }
  };
}

test("verifier: passes and generates cryptographic certificate when evidence satisfies specification", () => {
  const program = baseProgram();
  const evidence = {
    version: "0.1",
    facts: {
      "test_suite.status": "passing",
      "migration.completed": true
    },
    files: {
      modified: ["src/migration.ts"]
    }
  };

  const report = verifyEvidence(program, evidence);
  assert.equal(report.ok, true);
  assert.equal(report.summary.violated, 0);
  assert.equal(report.summary.inconclusive, 0);
  assert.equal(report.summary.verified, 3);
  assert.ok(report.certificate);
  assert.equal(typeof report.certificate, "string");
  assert.equal(report.certificate.length, 64); // SHA-256 hex string

  const text = formatVerificationReport(report);
  assert.match(text, /VERIFIED \(ALL CHECKS PASSED\)/);
  assert.match(text, /Verification Certificate:/);
});

test("verifier: detects deleted file violating invariant", () => {
  const program = baseProgram();
  const evidence = {
    version: "0.1",
    files: {
      deleted: ["db/database_schema.sql"]
    },
    facts: {
      "test_suite.status": "passing",
      "migration.completed": true
    }
  };

  const report = verifyEvidence(program, evidence);
  assert.equal(report.ok, false);
  assert.equal(report.summary.violated, 1);
  const check = report.checks.find((c) => c.status === "violated");
  assert.ok(check);
  assert.match(check.message, /file 'db\/database_schema.sql' was deleted/);
  assert.equal(report.certificate, undefined);
});

test("verifier: detects modified file violating immutability invariant", () => {
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
        propositions: [{ path: "d", raw: "d" }],
        line: 3
      }
    ]
  };

  const evidence = {
    version: "0.1",
    files: {
      modified: ["var/log/audit_log.json"]
    },
    facts: { v: true, d: true }
  };

  const report = verifyEvidence(program, evidence);
  assert.equal(report.ok, false);
  assert.equal(report.summary.violated, 1);
  const check = report.checks.find((c) => c.status === "violated");
  assert.ok(check);
  assert.match(check.message, /immutable entity 'var\/log\/audit_log.json' was modified/);
});

test("verifier: marks unobserved verification conditions as inconclusive", () => {
  const program = baseProgram();
  const evidence = {
    version: "0.1",
    facts: {
      "migration.completed": true
    }
  };

  const report = verifyEvidence(program, evidence);
  assert.equal(report.ok, false);
  assert.equal(report.summary.inconclusive, 1);
  const inconclusive = report.checks.find((c) => c.status === "inconclusive");
  assert.ok(inconclusive);
  assert.equal(inconclusive.path, "test_suite.status");
});
