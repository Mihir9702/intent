import type { IntentProgram, IntentStatement } from "../model.js";

const TAG: Record<IntentStatement["kind"], string> = {
  goal: "goals",
  observation: "observations",
  hypothesis: "hypotheses",
  constraint: "constraints",
  invariant: "invariants",
  risk: "risks",
  verification: "verification",
  done: "completion_conditions"
};

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderClaude(program: IntentProgram): string {
  const grouped = new Map<IntentStatement["kind"], IntentStatement[]>();
  for (const statement of program.statements) {
    grouped.set(statement.kind, [...(grouped.get(statement.kind) ?? []), statement]);
  }

  const lines = [`<intent version="${program.version}">`];
  for (const kind of Object.keys(TAG) as IntentStatement["kind"][]) {
    const statements = grouped.get(kind);
    if (!statements?.length) continue;
    lines.push(`  <${TAG[kind]}>`);
    for (const statement of statements) {
      for (const p of statement.propositions) {
        const body = p.value === undefined ? p.path : `${p.path} = ${JSON.stringify(p.value)}`;
        const confidence = statement.confidence === undefined ? "" : ` confidence="${statement.confidence}"`;
        lines.push(`    <item${confidence}>${escapeXml(body)}</item>`);
      }
    }
    lines.push(`  </${TAG[kind]}>`);
  }
  lines.push("</intent>");
  return lines.join("\n");
}
