import type { IntentProgram, IntentStatement, Scalar } from "./model.js";
import type { CanonicalEntity, CanonicalOperation } from "./ontology/model.js";

export interface EntityChange {
  id: string;
  type: "added" | "removed" | "modified";
  before?: CanonicalEntity;
  after?: CanonicalEntity;
  details?: string[];
}

export interface OperationChange {
  id: string;
  type: "added" | "removed" | "modified";
  before?: CanonicalOperation;
  after?: CanonicalOperation;
  details?: string[];
}

export interface StatementChange {
  path: string;
  kind: string;
  type: "added" | "removed" | "modified";
  before?: Scalar;
  after?: Scalar;
}

export interface ProgramDiff {
  identical: boolean;
  breaking: boolean;
  entities: EntityChange[];
  operations: OperationChange[];
  statements: StatementChange[];
  breakingReasons: string[];
}

function formatScalar(value: Scalar): string {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

export function diffPrograms(a: IntentProgram, b: IntentProgram): ProgramDiff {
  const entityChanges: EntityChange[] = [];
  const opChanges: OperationChange[] = [];
  const stmtChanges: StatementChange[] = [];
  const breakingReasons: string[] = [];

  const aEntities = new Map<string, CanonicalEntity>((a.semantics?.entities ?? []).map((e) => [e.id, e]));
  const bEntities = new Map<string, CanonicalEntity>((b.semantics?.entities ?? []).map((e) => [e.id, e]));

  // Check removed or modified entities
  for (const [id, entityA] of aEntities) {
    const entityB = bEntities.get(id);
    if (!entityB) {
      entityChanges.push({ id, type: "removed", before: entityA });
      breakingReasons.push(`removed entity '@${id}'`);
    } else {
      const details: string[] = [];
      if (entityA.kind !== entityB.kind) details.push(`kind changed from '${entityA.kind}' to '${entityB.kind}'`);
      if (entityA.type !== entityB.type) details.push(`type changed from '${String(entityA.type)}' to '${String(entityB.type)}'`);
      if (entityA.resolution !== entityB.resolution) details.push(`resolution changed from '${entityA.resolution}' to '${entityB.resolution}'`);

      if (details.length > 0) {
        entityChanges.push({ id, type: "modified", before: entityA, after: entityB, details });
      }
    }
  }

  // Check added entities
  for (const [id, entityB] of bEntities) {
    if (!aEntities.has(id)) {
      entityChanges.push({ id, type: "added", after: entityB });
    }
  }

  // Operations
  const aOps = new Map<string, CanonicalOperation>((a.semantics?.operations ?? []).map((o) => [o.id, o]));
  const bOps = new Map<string, CanonicalOperation>((b.semantics?.operations ?? []).map((o) => [o.id, o]));

  for (const [id, opA] of aOps) {
    const opB = bOps.get(id);
    if (!opB) {
      opChanges.push({ id, type: "removed", before: opA });
      breakingReasons.push(`removed operation '[${id}]'`);
    } else {
      const details: string[] = [];
      if (opA.kind !== opB.kind) details.push(`kind changed from '${opA.kind}' to '${opB.kind}'`);
      if (opA.target !== opB.target) details.push(`target changed from '${String(opA.target)}' to '${String(opB.target)}'`);
      const depsA = opA.dependsOn.join(",");
      const depsB = opB.dependsOn.join(",");
      if (depsA !== depsB) details.push(`dependencies changed from [${depsA}] to [${depsB}]`);

      if (details.length > 0) {
        opChanges.push({ id, type: "modified", before: opA, after: opB, details });
      }
    }
  }

  for (const [id, opB] of bOps) {
    if (!aOps.has(id)) {
      opChanges.push({ id, type: "added", after: opB });
    }
  }

  // Statements
  const aProps = new Map<string, { kind: string; value: Scalar; raw: string }>();
  for (const s of a.statements) {
    for (const p of s.propositions) {
      aProps.set(`${s.kind}:${p.path}`, { kind: s.kind, value: p.value ?? null, raw: p.raw });
    }
  }

  const bProps = new Map<string, { kind: string; value: Scalar; raw: string }>();
  for (const s of b.statements) {
    for (const p of s.propositions) {
      bProps.set(`${s.kind}:${p.path}`, { kind: s.kind, value: p.value ?? null, raw: p.raw });
    }
  }

  for (const [key, propA] of aProps) {
    const propB = bProps.get(key);
    const path = key.slice(propA.kind.length + 1);
    if (!propB) {
      stmtChanges.push({ path, kind: propA.kind, type: "removed", before: propA.value });
    } else if (JSON.stringify(propA.value) !== JSON.stringify(propB.value)) {
      stmtChanges.push({ path, kind: propA.kind, type: "modified", before: propA.value, after: propB.value });
      if (propA.kind === "invariant" || propA.kind === "constraint") {
        breakingReasons.push(`policy changed for '${path}'`);
      }
    }
  }

  for (const [key, propB] of bProps) {
    if (!aProps.has(key)) {
      const path = key.slice(propB.kind.length + 1);
      stmtChanges.push({ path, kind: propB.kind, type: "added", after: propB.value });
      if (propB.kind === "invariant" || propB.kind === "constraint") {
        breakingReasons.push(`added new ${propB.kind} on '${path}'`);
      }
    }
  }

  const identical = entityChanges.length === 0 && opChanges.length === 0 && stmtChanges.length === 0;
  const breaking = breakingReasons.length > 0;

  return {
    identical,
    breaking,
    entities: entityChanges,
    operations: opChanges,
    statements: stmtChanges,
    breakingReasons
  };
}

export function formatProgramDiff(diff: ProgramDiff): string {
  if (diff.identical) {
    return "No semantic differences between programs.";
  }

  const lines: string[] = [
    "================================================================================",
    " INTENT SEMANTIC AST DIFF",
    ` Status: ${diff.breaking ? "POTENTIALLY BREAKING CHANGES DETECTED" : "NON-BREAKING EVOLUTION"}`,
    "================================================================================"
  ];

  if (diff.entities.length) {
    lines.push("Canonical Entities:");
    for (const ec of diff.entities) {
      if (ec.type === "added") {
        lines.push(`  + @${ec.id} <${ec.after?.kind}${ec.after?.type ? `:${ec.after.type}` : ""}>`);
      } else if (ec.type === "removed") {
        lines.push(`  - @${ec.id} <${ec.before?.kind}>`);
      } else {
        lines.push(`  ~ @${ec.id}: ${ec.details?.join(", ")}`);
      }
    }
  }

  if (diff.operations.length) {
    lines.push("\nCanonical Operations:");
    for (const oc of diff.operations) {
      if (oc.type === "added") {
        lines.push(`  + [${oc.id}] ${oc.after?.kind} on @${oc.after?.target}`);
      } else if (oc.type === "removed") {
        lines.push(`  - [${oc.id}] ${oc.before?.kind}`);
      } else {
        lines.push(`  ~ [${oc.id}]: ${oc.details?.join(", ")}`);
      }
    }
  }

  if (diff.statements.length) {
    lines.push("\nPolicy & Logic Statements:");
    for (const sc of diff.statements) {
      if (sc.type === "added") {
        lines.push(`  + ${sc.kind}: ${sc.path} = ${formatScalar(sc.after ?? null)}`);
      } else if (sc.type === "removed") {
        lines.push(`  - ${sc.kind}: ${sc.path}`);
      } else {
        lines.push(`  ~ ${sc.kind}: ${sc.path} (${formatScalar(sc.before ?? null)} -> ${formatScalar(sc.after ?? null)})`);
      }
    }
  }

  if (diff.breaking) {
    lines.push("\nBreaking change warnings:");
    for (const reason of diff.breakingReasons) {
      lines.push(`  ! ${reason}`);
    }
  }

  lines.push("================================================================================");
  return lines.join("\n");
}
