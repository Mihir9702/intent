import type { IntentProgram, StatementKind } from "./model.js";

export interface InheritedPolicyOptions {
  kinds?: readonly StatementKind[];
}

const DEFAULT_POLICY_KINDS: readonly StatementKind[] = ["constraint", "invariant"];

/**
 * Merge stable project policy into a task without importing goals or observations
 * from the policy files. Source provenance on inherited statements is preserved.
 */
export function applyInheritedPolicies(
  task: IntentProgram,
  inherited: readonly IntentProgram[],
  options: InheritedPolicyOptions = {}
): IntentProgram {
  const kinds = new Set(options.kinds ?? DEFAULT_POLICY_KINDS);
  const inheritedStatements = inherited.flatMap((program) =>
    program.statements.filter((statement) => kinds.has(statement.kind))
  );

  const unresolved = [
    ...inherited.flatMap((program) => program.unresolved ?? []),
    ...(task.unresolved ?? [])
  ];

  return {
    ...task,
    statements: [...inheritedStatements, ...task.statements],
    unresolved: unresolved.length ? unresolved : undefined
  };
}
