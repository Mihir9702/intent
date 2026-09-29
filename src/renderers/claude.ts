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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderClaude(program: IntentProgram): string {
  const grouped = new Map<IntentStatement["kind"], IntentStatement[]>();
  for (const statement of program.statements) {
    grouped.set(statement.kind, [...(grouped.get(statement.kind) ?? []), statement]);
  }

  const lines = [`<intent version="${program.version}">`];

  if (program.semantics) {
    lines.push(`  <canonical_semantics ontology="${escapeXml(program.semantics.ontology)}">`);
    lines.push("    <entities>");
    for (const entity of program.semantics.entities) {
      const type = entity.type ? ` type="${escapeXml(entity.type)}"` : "";
      const label = entity.label ? ` label="${escapeXml(entity.label)}"` : "";
      lines.push(
        `      <entity id="${escapeXml(entity.id)}" kind="${entity.kind}" resolution="${entity.resolution}"${type}${label}/>`
      );
    }
    lines.push("    </entities>");
    lines.push("    <operations>");
    for (const operation of program.semantics.operations) {
      const target = operation.target ? ` target="${escapeXml(operation.target)}"` : "";
      lines.push(`      <operation id="${escapeXml(operation.id)}" kind="${operation.kind}"${target}>`);
      for (const dependency of operation.dependsOn) {
        lines.push(`        <depends_on operation="${escapeXml(dependency)}"/>`);
      }
      for (const argument of operation.arguments) {
        if ("entity" in argument && typeof argument.entity === "string") {
          lines.push(`        <arg role="${argument.role}" entity="${escapeXml(argument.entity)}"/>`);
        } else {
          lines.push(`        <arg role="${argument.role}" value="${escapeXml(JSON.stringify(argument.value))}"/>`);
        }
      }
      lines.push("      </operation>");
    }
    lines.push("    </operations>");
    lines.push("  </canonical_semantics>");
  }

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
