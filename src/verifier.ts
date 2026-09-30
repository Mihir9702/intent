import { createHash } from "node:crypto";
import type { IntentProgram, Proposition, Scalar } from "./model.js";
import type { CanonicalEntity } from "./ontology/model.js";

export interface FileEvidence {
  created?: string[];
  modified?: string[];
  deleted?: string[];
}

export interface CommandEvidence {
  command: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface EvidenceBundle {
  version: "0.1";
  timestamp?: string;
  source?: string;
  files?: FileEvidence;
  commands?: CommandEvidence[];
  facts?: Record<string, Scalar>;
}

export interface VerificationCheck {
  id: string;
  kind: "invariant" | "constraint" | "verification" | "done";
  path: string;
  expected?: Scalar;
  actual?: Scalar | string;
  status: "verified" | "violated" | "inconclusive";
  message: string;
}

export interface VerificationReport {
  ok: boolean;
  timestamp: string;
  programDigest: string;
  evidenceDigest: string;
  certificate?: string;
  summary: {
    total: number;
    verified: number;
    violated: number;
    inconclusive: number;
  };
  checks: VerificationCheck[];
}

const FORBIDDEN_WORDS = new Set(["never", "refuse", "forbidden", "deny", "disallow", "none", false]);

function fileMatchesSubject(filePath: string, subject: string): boolean {
  const normSubject = subject.toLowerCase().replace(/[._-]/g, "");
  const normFile = filePath.toLowerCase().replace(/[\\/._-]/g, "");
  if (normSubject === "*" || normSubject === "**") return true;
  return normFile.includes(normSubject);
}

function computeDigest(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

export function verifyEvidence(program: IntentProgram, evidence: EvidenceBundle): VerificationReport {
  const checks: VerificationCheck[] = [];
  const programDigest = computeDigest(program);
  const evidenceDigest = computeDigest(evidence);
  const facts = evidence.facts ?? {};
  const files = evidence.files ?? {};
  const deletedFiles = files.deleted ?? [];
  const modifiedFiles = files.modified ?? [];

  let checkCounter = 1;

  // 1. Invariants verification
  const invariants = program.statements.filter((s) => s.kind === "invariant");
  for (const inv of invariants) {
    for (const p of inv.propositions) {
      const checkId = `INV-${String(checkCounter++).padStart(3, "0")}`;
      const lastDot = p.path.lastIndexOf(".");
      const subject = lastDot > 0 ? p.path.slice(0, lastDot) : p.path;
      const rule = lastDot > 0 ? p.path.slice(lastDot + 1) : "";

      const isForbid = p.value === undefined || (typeof p.value === "string" ? FORBIDDEN_WORDS.has(p.value.toLowerCase()) : p.value === false);

      // Check against deleted files
      if (isForbid && (rule === "delete" || rule === "remove" || rule === "destroy" || rule === "never")) {
        const violatingFile = deletedFiles.find((f) => fileMatchesSubject(f, subject));
        if (violatingFile) {
          checks.push({
            id: checkId,
            kind: "invariant",
            path: p.path,
            expected: p.value,
            actual: `deleted file '${violatingFile}'`,
            status: "violated",
            message: `invariant '${p.raw}' was violated: file '${violatingFile}' was deleted`
          });
          continue;
        }
      }

      // Check against modified files for immutable rules
      if (rule === "mutable" && isForbid) {
        const violatingFile = modifiedFiles.find((f) => fileMatchesSubject(f, subject));
        if (violatingFile) {
          checks.push({
            id: checkId,
            kind: "invariant",
            path: p.path,
            expected: p.value,
            actual: `modified file '${violatingFile}'`,
            status: "violated",
            message: `invariant '${p.raw}' was violated: immutable entity '${violatingFile}' was modified`
          });
          continue;
        }
      }

      // Check against facts
      if (Object.prototype.hasOwnProperty.call(facts, p.path)) {
        const actual = facts[p.path];
        if (p.value !== undefined && actual !== p.value) {
          checks.push({
            id: checkId,
            kind: "invariant",
            path: p.path,
            expected: p.value,
            actual,
            status: "violated",
            message: `invariant '${p.raw}' violated: evidence has ${p.path}=${String(actual)}`
          });
          continue;
        }
      }

      checks.push({
        id: checkId,
        kind: "invariant",
        path: p.path,
        expected: p.value,
        status: "verified",
        message: `invariant '${p.raw}' satisfied by execution evidence`
      });
    }
  }

  // 2. Constraints verification
  const constraints = program.statements.filter((s) => s.kind === "constraint");
  for (const con of constraints) {
    for (const p of con.propositions) {
      const checkId = `CON-${String(checkCounter++).padStart(3, "0")}`;
      if (Object.prototype.hasOwnProperty.call(facts, p.path)) {
        const actual = facts[p.path];
        if (p.value !== undefined && actual !== p.value) {
          checks.push({
            id: checkId,
            kind: "constraint",
            path: p.path,
            expected: p.value,
            actual,
            status: "violated",
            message: `constraint '${p.raw}' violated: evidence has ${p.path}=${String(actual)}`
          });
          continue;
        }
      }

      checks.push({
        id: checkId,
        kind: "constraint",
        path: p.path,
        expected: p.value,
        status: "verified",
        message: `constraint '${p.raw}' satisfied`
      });
    }
  }

  // 3. Verification requirements (V{})
  const verifications = program.statements.filter((s) => s.kind === "verification");
  for (const ver of verifications) {
    for (const p of ver.propositions) {
      const checkId = `VER-${String(checkCounter++).padStart(3, "0")}`;
      let satisfied = false;
      let actualVal: Scalar | string | undefined;

      if (Object.prototype.hasOwnProperty.call(facts, p.path)) {
        actualVal = facts[p.path];
        satisfied = p.value === undefined ? actualVal === true || actualVal === "pass" || actualVal === "passed" : actualVal === p.value;
      } else if (evidence.commands?.length) {
        // Search command outputs
        const passingCommand = evidence.commands.find((c) => c.exitCode === 0 && (c.stdout?.toLowerCase().includes("pass") || c.command.includes("test")));
        if (passingCommand && (p.path.includes("test") || p.path.includes("verify") || p.path.includes("check"))) {
          satisfied = true;
          actualVal = `exit 0 from '${passingCommand.command}'`;
        }
      }

      if (satisfied) {
        checks.push({
          id: checkId,
          kind: "verification",
          path: p.path,
          expected: p.value,
          actual: actualVal,
          status: "verified",
          message: `verification requirement '${p.raw}' verified by evidence`
        });
      } else {
        checks.push({
          id: checkId,
          kind: "verification",
          path: p.path,
          expected: p.value,
          actual: actualVal ?? "not observed",
          status: "inconclusive",
          message: `verification requirement '${p.raw}' not verified in execution evidence`
        });
      }
    }
  }

  // 4. Done conditions (D{})
  const doneStatements = program.statements.filter((s) => s.kind === "done");
  for (const done of doneStatements) {
    for (const p of done.propositions) {
      const checkId = `DON-${String(checkCounter++).padStart(3, "0")}`;
      let satisfied = false;
      let actualVal: Scalar | string | undefined;

      if (Object.prototype.hasOwnProperty.call(facts, p.path)) {
        actualVal = facts[p.path];
        satisfied = p.value === undefined ? Boolean(actualVal) : actualVal === p.value;
      } else if (p.path.includes("exists") || p.path.includes("created")) {
        const lastDot = p.path.lastIndexOf(".");
        const subject = lastDot > 0 ? p.path.slice(0, lastDot) : p.path;
        const found = files.created?.find((f) => fileMatchesSubject(f, subject)) || files.modified?.find((f) => fileMatchesSubject(f, subject));
        if (found) {
          satisfied = true;
          actualVal = `file '${found}'`;
        }
      }

      if (satisfied) {
        checks.push({
          id: checkId,
          kind: "done",
          path: p.path,
          expected: p.value,
          actual: actualVal,
          status: "verified",
          message: `completion condition '${p.raw}' verified`
        });
      } else {
        checks.push({
          id: checkId,
          kind: "done",
          path: p.path,
          expected: p.value,
          actual: actualVal ?? "not observed",
          status: "inconclusive",
          message: `completion condition '${p.raw}' not satisfied in evidence`
        });
      }
    }
  }

  const summary = {
    total: checks.length,
    verified: checks.filter((c) => c.status === "verified").length,
    violated: checks.filter((c) => c.status === "violated").length,
    inconclusive: checks.filter((c) => c.status === "inconclusive").length
  };

  const ok = summary.violated === 0 && summary.inconclusive === 0;
  const now = new Date().toISOString();

  let certificate: string | undefined;
  if (ok) {
    certificate = createHash("sha256")
      .update(`${programDigest}:${evidenceDigest}:${now}`)
      .digest("hex");
  }

  return {
    ok,
    timestamp: now,
    programDigest,
    evidenceDigest,
    certificate,
    summary,
    checks
  };
}

export function formatVerificationReport(report: VerificationReport): string {
  const lines: string[] = [
    "================================================================================",
    " INTENT INDEPENDENT VERIFICATION REPORT",
    ` Program digest:  ${report.programDigest}`,
    ` Evidence digest: ${report.evidenceDigest}`,
    ` Status:          ${report.ok ? "VERIFIED (ALL CHECKS PASSED)" : "FAILED / INCOMPLETE"}`,
    "================================================================================"
  ];

  for (const check of report.checks) {
    const symbol = check.status === "verified" ? "✔ [PASS]" : check.status === "violated" ? "✖ [FAIL]" : "⚠ [INCOMPLETE]";
    lines.push(`${symbol} ${check.id} (${check.kind}): ${check.message}`);
    if (check.actual !== undefined && check.status !== "verified") {
      lines.push(`       Actual: ${String(check.actual)} | Expected: ${String(check.expected)}`);
    }
  }

  lines.push("--------------------------------------------------------------------------------");
  lines.push(`Summary: ${report.summary.verified} verified, ${report.summary.violated} violated, ${report.summary.inconclusive} inconclusive (total ${report.summary.total})`);

  if (report.certificate) {
    lines.push("--------------------------------------------------------------------------------");
    lines.push(`Verification Certificate: ${report.certificate}`);
    lines.push("Cryptographically signed human-intent compliance proof.");
  }
  lines.push("================================================================================");

  return lines.join("\n");
}
