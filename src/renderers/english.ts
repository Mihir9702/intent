import type { IntentProgram, IntentStatement } from "../model.js";

const LABELS: Record<IntentStatement["kind"], string> = {
  goal: "Goals",
  observation: "Observations",
  hypothesis: "Hypotheses",
  constraint: "Constraints",
  invariant: "Invariants",
  risk: "Risks",
  verification: "Verification",
  done: "Completion conditions"
};

function describe(statement: IntentStatement): string[] {
  const provenance = statement.source ? ` [${statement.source}:${statement.line}]` : "";
  return statement.propositions.map((p) => {
    const claim = p.value === undefined ? p.path : `${p.path} = ${JSON.stringify(p.value)}`;
    const confidence = statement.confidence === undefined
      ? ""
      : ` (confidence ${(statement.confidence * 100).toFixed(0)}%)`;
    return `${claim}${confidence}${provenance}`;
  });
}

export function renderEnglish(program: IntentProgram): string {
  const groups = new Map<IntentStatement["kind"], IntentStatement[]>();
  for (const statement of program.statements) {
    groups.set(statement.kind, [...(groups.get(statement.kind) ?? []), statement]);
  }

  const sections: string[] = [];
  for (const kind of Object.keys(LABELS) as IntentStatement["kind"][]) {
    const statements = groups.get(kind);
    if (!statements?.length) continue;
    const lines = statements.flatMap(describe).map((line) => `- ${line}`);
    sections.push(`${LABELS[kind]}\n${lines.join("\n")}`);
  }

  if (program.unresolved?.length) {
    const lines = program.unresolved.map((ref) => {
      const candidates = ref.candidates.length ? ref.candidates.join(", ") : "none supplied";
      const destructive = ref.destructive ? " [destructive]" : "";
      return `- ${ref.id}: "${ref.text}" → candidates: ${candidates}${destructive}`;
    });
    sections.push(`Unresolved references\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
