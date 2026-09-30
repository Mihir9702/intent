import type { Diagnostic, IntentProgram, Proposition, ValidationResult } from "./model.js";
import type { CanonicalEntity } from "./ontology/model.js";
import { validateProgramShape } from "./schema.js";
import { typeCheckSemantics } from "./ontology/typechecker.js";

function scalarKey(value: Proposition["value"]): string {
  return JSON.stringify(value);
}

const MUTATING_OPERATIONS = new Set([
  "create",
  "update",
  "set",
  "delete",
  "replace",
  "link",
  "unlink",
  "move",
  "copy"
]);

const FORBIDDEN_VALUES = new Set(["never", "refuse", "forbidden", "deny", "disallow", "none", false]);

function entityMatchesSubject(entity: CanonicalEntity, subject: string): boolean {
  const normSubject = subject.toLowerCase();
  if (entity.id.toLowerCase() === normSubject) return true;

  const normKind = entity.kind.toLowerCase();
  if (normKind === normSubject || `${normKind}s` === normSubject) return true;

  if (entity.type) {
    const normType = entity.type.toLowerCase();
    if (normType === normSubject) return true;
    if (normType.endsWith(`.${normSubject}`)) return true;
    if (`${normType}s` === normSubject || `${normType}s`.endsWith(`.${normSubject}`)) return true;
  }

  return false;
}

function operationViolatesRule(opKind: string, rule: string, value: Proposition["value"]): boolean {
  const isForbidden = value === undefined || (typeof value === "string" ? FORBIDDEN_VALUES.has(value.toLowerCase()) : value === false);

  if (rule === "mutable") {
    return isForbidden && MUTATING_OPERATIONS.has(opKind);
  }
  if (rule === "immutable") {
    return (value === true || value === "always") && MUTATING_OPERATIONS.has(opKind);
  }
  if (rule === "action") {
    return isForbidden;
  }
  if (rule === opKind) {
    return isForbidden;
  }
  if (rule === "rewrite" && (opKind === "replace" || opKind === "update" || opKind === "set" || opKind === "delete")) {
    return isForbidden;
  }
  if (rule === "remove" && (opKind === "delete" || opKind === "unlink")) {
    return isForbidden;
  }
  if (rule === "modify" && (opKind === "update" || opKind === "set" || opKind === "replace")) {
    return isForbidden;
  }
  if (rule === "destroy" && (opKind === "delete" || opKind === "replace")) {
    return isForbidden;
  }

  return false;
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
        ["observation", "invariant", "constraint"].includes(statement.kind) &&
        ["observation", "invariant", "constraint"].includes(prior.kind)
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
      } else if (["observation", "invariant", "constraint"].includes(statement.kind)) {
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

  // v0.3 legacy-statement semantic protection: goals violating invariants is a compile error (E201).
  for (const goal of goals) {
    for (const gp of goal.propositions) {
      for (const invariant of invariants) {
        for (const ip of invariant.propositions) {
          if (ip.path === gp.path) {
            const hasConflict = gp.value !== undefined && ip.value !== undefined
              ? scalarKey(ip.value) !== scalarKey(gp.value)
              : (typeof ip.value === "string" ? FORBIDDEN_VALUES.has(ip.value.toLowerCase()) : ip.value === false);

            if (hasConflict) {
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
  }

  // Canonical operations semantic protection: operations cannot violate declared or inherited invariants (E202).
  if (program.semantics?.operations.length && invariants.length) {
    const entityMap = new Map<string, CanonicalEntity>(
      program.semantics.entities.map((e) => [e.id, e])
    );

    for (const operation of program.semantics.operations) {
      const affectedEntities: Array<{ entity: CanonicalEntity; role: string }> = [];

      if (operation.target) {
        const targetEntity = entityMap.get(operation.target);
        if (targetEntity) affectedEntities.push({ entity: targetEntity, role: "target" });
      }

      for (const argument of operation.arguments) {
        if ("entity" in argument && typeof argument.entity === "string") {
          const argEntity = entityMap.get(argument.entity);
          if (argEntity && ["related", "to", "with"].includes(argument.role)) {
            affectedEntities.push({ entity: argEntity, role: argument.role });
          }
        }
      }

      for (const { entity, role } of affectedEntities) {
        for (const invariant of invariants) {
          for (const ip of invariant.propositions) {
            const lastDot = ip.path.lastIndexOf(".");
            if (lastDot <= 0) continue;
            const subject = ip.path.slice(0, lastDot);
            const rule = ip.path.slice(lastDot + 1);

            if (entityMatchesSubject(entity, subject) && operationViolatesRule(operation.kind, rule, ip.value)) {
              diagnostics.push({
                severity: "error",
                code: "E202",
                message: `operation '${operation.id}' (${operation.kind}) violates invariant '${ip.raw}' on ${role} '${entity.id}'`,
                line: operation.line,
                source: operation.source,
                relatedLine: invariant.line,
                relatedSource: invariant.source
              });
            }
          }
        }
      }
    }
  }

  return { ok: !diagnostics.some((d) => d.severity === "error"), diagnostics };
}
