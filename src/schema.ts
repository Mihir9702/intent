import type { Diagnostic, IntentProgram, IntentStatement, Proposition } from "./model.js";
import { validateSemanticsShape } from "./ontology/schema.js";

const KINDS = new Set([
  "goal",
  "observation",
  "hypothesis",
  "constraint",
  "invariant",
  "risk",
  "verification",
  "done"
]);

const PATH = /^[A-Za-z_*][A-Za-z0-9_.:*-]*$/;

function isScalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function validateProgramShape(program: IntentProgram): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (program.version !== "0.3") {
    diagnostics.push({ severity: "error", code: "E001", message: `unsupported Intent version '${String(program.version)}'` });
  }

  if (!Array.isArray(program.statements)) {
    diagnostics.push({ severity: "error", code: "E002", message: "program statements must be an array" });
    return diagnostics;
  }

  for (const statement of program.statements as IntentStatement[]) {
    if (!KINDS.has(statement.kind)) {
      diagnostics.push({ severity: "error", code: "E003", message: `unknown statement kind '${String(statement.kind)}'`, line: statement.line });
    }
    if (!Number.isInteger(statement.line) || statement.line < 1) {
      diagnostics.push({ severity: "error", code: "E004", message: "statement line must be a positive integer" });
    }
    if (!Array.isArray(statement.propositions) || statement.propositions.length === 0) {
      diagnostics.push({ severity: "error", code: "E005", message: "statement must contain at least one proposition", line: statement.line });
      continue;
    }
    if (statement.confidence !== undefined) {
      if (!["hypothesis", "risk"].includes(statement.kind)) {
        diagnostics.push({ severity: "error", code: "E006", message: "confidence is only valid on hypotheses and risks", line: statement.line });
      }
      if (typeof statement.confidence !== "number" || statement.confidence < 0 || statement.confidence > 1) {
        diagnostics.push({ severity: "error", code: "E007", message: "confidence must be between 0 and 1", line: statement.line });
      }
    }

    for (const proposition of statement.propositions as Proposition[]) {
      if (typeof proposition.path !== "string" || !PATH.test(proposition.path)) {
        diagnostics.push({ severity: "error", code: "E008", message: `invalid proposition path '${String(proposition.path)}'`, line: statement.line });
      }
      if (proposition.value !== undefined && !isScalar(proposition.value)) {
        diagnostics.push({ severity: "error", code: "E009", message: `non-scalar value on '${proposition.path}'`, line: statement.line });
      }
      if (typeof proposition.raw !== "string" || proposition.raw.length === 0) {
        diagnostics.push({ severity: "error", code: "E010", message: `missing raw source for '${proposition.path}'`, line: statement.line });
      }
    }
  }

  if (program.semantics !== undefined) {
    diagnostics.push(...validateSemanticsShape(program.semantics));
  }

  if (program.unresolved !== undefined) {
    if (!Array.isArray(program.unresolved)) {
      diagnostics.push({ severity: "error", code: "E011", message: "program unresolved must be an array" });
    } else {
      for (const ref of program.unresolved) {
        if (!ref || typeof ref.id !== "string" || typeof ref.text !== "string") {
          diagnostics.push({ severity: "error", code: "E012", message: "invalid unresolved reference" });
          continue;
        }
        if (!Array.isArray(ref.candidates) || ref.candidates.some((c) => typeof c !== "string")) {
          diagnostics.push({ severity: "error", code: "E013", message: `invalid candidates for unresolved reference '${ref.id}'` });
        }
      }
    }
  }

  return diagnostics;
}
