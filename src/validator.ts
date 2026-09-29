import type { Diagnostic, IntentProgram, Proposition, ValidationResult } from "./model.js";
import { validateProgramShape } from "./schema.js";
import { typeCheckSemantics } from "./ontology/typechecker.js";

function scalarKey(value: Proposition["value"]): string {
  return JSON.stringify(value);
}

export function validateIntent(program: IntentProgram): ValidationResult {
  const diagnostics: Diagnostic[] = [...validateProgramShape(program)];
  if (diagnostics.some((d) => d.severity === "error")) return { ok: false, diagnostics };

  if (program.semantics) {
    diagnostics.push(...typeCheckSemantics(program.semantics));
  }

  for (const ref of program.unresolved ?? []) {
    diagnostics.push({
      severity: "error",
      code: "E301",
      message: `unresolved reference '${ref.text}' requires resolution before compilation`,
      line: ref.line,
      source: ref.source
    });
  }

  const facts = new Map<string, { value: Proposition["value"]; line: number; kind: string; source?: string }>();

  for (const statement of program.statements) {
    for (const proposition of statement.propositions) {
      if (proposition.value === undefined) continue;
      const key = proposition.path;
      const prior = facts.get(key);
      if (
        prior &&
        scalarKey(prior.value) !== scalarKey(proposition.value) &&
        ["observation", "invariant"].includes(statement.kind) &&
        ["observation", "invariant"].includes(prior.kind)
      ) {
        diagnostics.push({
          severity: "error",
          code: "E117",
          message: `conflicting ${statement.kind} for '${key}': ${String(prior.value)} vs ${String(proposition.value)}`,
          line: statement.line,
          source: statement.source,
          relatedLine: prior.line,
          relatedSource: prior.source
        });
      } else if (["observation", "invariant"].includes(statement.kind)) {
        facts.set(key, { value: proposition.value, line: statement.line, kind: statement.kind, source: statement.source });
      }
    }
  }

  const goals = program.statements.filter((s) => s.kind === "goal");
  const verification = program.statements.filter((s) => s.kind === "verification");
  const done = program.statements.filter((s) => s.kind === "done");
  const invariants = program.statements.filter((s) => s.kind === "invariant");

  const hasCanonicalOperations = (program.semantics?.operations.length ?? 0) > 0;
  if (goals.length === 0 && !hasCanonicalOperations) {
    diagnostics.push({ severity: "warning", code: "W101", message: "program has no goal or canonical operation" });
  }
  if (verification.length === 0) diagnostics.push({ severity: "warning", code: "W102", message: "program has no verification requirements" });
  if (done.length === 0) diagnostics.push({ severity: "warning", code: "W103", message: "program has no explicit completion conditions" });

  // v0.3 legacy-statement semantic protection: a goal assigning a value directly against an invariant is a compile error.
  for (const goal of goals) {
    for (const gp of goal.propositions) {
      if (gp.value === undefined) continue;
      for (const invariant of invariants) {
        for (const ip of invariant.propositions) {
          if (ip.path === gp.path && ip.value !== undefined && scalarKey(ip.value) !== scalarKey(gp.value)) {
            diagnostics.push({
              severity: "error",
              code: "E201",
              message: `goal '${gp.raw}' violates invariant '${ip.raw}'`,
              line: goal.line,
              source: goal.source,
              relatedLine: invariant.line,
              relatedSource: invariant.source
            });
          }
        }
      }
    }
  }

  return { ok: !diagnostics.some((d) => d.severity === "error"), diagnostics };
}
