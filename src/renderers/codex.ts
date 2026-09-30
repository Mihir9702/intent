import type { IntentProgram, IntentStatement, Scalar } from "../model.js";
import { OPERATION_SIGNATURES } from "../ontology/registry.js";

function formatScalar(value: Scalar): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function statementLine(statement: IntentStatement): string[] {
  const provenance = statement.source ? ` [${statement.source}:${statement.line}]` : "";
  return statement.propositions.map((p) => {
    const claim = p.value === undefined ? `\`${p.path}\`` : `\`${p.path}\` = ${formatScalar(p.value)}`;
    const confidence = statement.confidence === undefined
      ? ""
      : ` (confidence ${(statement.confidence * 100).toFixed(0)}%)`;
    return `- ${claim}${confidence}${provenance}`;
  });
}

export function renderCodex(program: IntentProgram): string {
  const sections: string[] = [
    `# Intent Execution Specification (v${program.version})`,
    "> Deterministic Intent Intermediate Representation for execution-capable agents."
  ];

  if (program.semantics) {
    sections.push(`**Ontology**: \`${program.semantics.ontology}\``);
  }

  const grouped = new Map<IntentStatement["kind"], IntentStatement[]>();
  for (const statement of program.statements) {
    grouped.set(statement.kind, [...(grouped.get(statement.kind) ?? []), statement]);
  }

  const invariants = grouped.get("invariant");
  if (invariants?.length) {
    const lines = invariants.flatMap(statementLine);
    sections.push(`## Invariants (Non-negotiable Rules)\n${lines.join("\n")}`);
  }

  const constraints = grouped.get("constraint");
  if (constraints?.length) {
    const lines = constraints.flatMap(statementLine);
    sections.push(`## Operational Constraints\n${lines.join("\n")}`);
  }

  if (program.semantics?.entities.length) {
    const lines = program.semantics.entities.map((entity) => {
      const type = entity.type ? `:${entity.type}` : "";
      const label = entity.label ? ` "${entity.label}"` : "";
      const status = entity.resolution === "unresolved" ? " **[UNRESOLVED]**" : "";
      return `- \`@${entity.id}\` <\`${entity.kind}${type}\`>${label}${status}`;
    });
    sections.push(`## Canonical Entities\n${lines.join("\n")}`);
  }

  if (program.semantics?.operations.length) {
    const lines = program.semantics.operations.map((operation, index) => {
      const target = operation.target ? ` on \`@${operation.target}\`` : "";
      const args = operation.arguments.map((argument) =>
        "entity" in argument && typeof argument.entity === "string"
          ? `${argument.role}=\`@${argument.entity}\``
          : `${argument.role}=${formatScalar(argument.value)}`
      );
      const argsStr = args.length ? ` (${args.join(", ")})` : "";
      const deps = operation.dependsOn.length ? operation.dependsOn.map((d) => `\`${d}\``).join(", ") : "none";
      const destructive = OPERATION_SIGNATURES[operation.kind]?.destructive ? "yes" : "no";

      return `${index + 1}. **\`[${operation.id}]\`** \`${operation.kind}\`${target}${argsStr}\n   - Depends on: ${deps}\n   - Destructive: ${destructive}`;
    });
    sections.push(`## Operation Plan\n${lines.join("\n")}`);
  }

  const observations = grouped.get("observation");
  if (observations?.length) {
    const lines = observations.flatMap(statementLine);
    sections.push(`## Observations (Established Facts)\n${lines.join("\n")}`);
  }

  const hypotheses = grouped.get("hypothesis");
  if (hypotheses?.length) {
    const lines = hypotheses.flatMap(statementLine);
    sections.push(`## Hypotheses\n${lines.join("\n")}`);
  }

  const risks = grouped.get("risk");
  if (risks?.length) {
    const lines = risks.flatMap(statementLine);
    sections.push(`## Identified Risks\n${lines.join("\n")}`);
  }

  const legacyGoals = grouped.get("goal");
  if (legacyGoals?.length) {
    const lines = legacyGoals.flatMap(statementLine);
    sections.push(`## Goals (Legacy Statements)\n${lines.join("\n")}`);
  }

  const verification = grouped.get("verification");
  if (verification?.length) {
    const lines = verification.flatMap(statementLine);
    sections.push(`## Verification Requirements\n${lines.join("\n")}`);
  }

  const done = grouped.get("done");
  if (done?.length) {
    const lines = done.flatMap(statementLine);
    sections.push(`## Completion Criteria\n${lines.join("\n")}`);
  }

  if (program.unresolved?.length) {
    const lines = program.unresolved.map((ref) => {
      const candidates = ref.candidates.length ? ref.candidates.map((c) => `"${c}"`).join(", ") : "none supplied";
      const destructive = ref.destructive ? " **[DESTRUCTIVE]**" : "";
      return `- \`[${ref.id}]\` "${ref.text}" → candidates: ${candidates}${destructive}`;
    });
    sections.push(`## Unresolved Ambiguities (BLOCKING)\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
