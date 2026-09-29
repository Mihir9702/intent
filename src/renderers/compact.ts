import type { IntentProgram, IntentStatement, Scalar } from "../model.js";

const TOKEN: Record<IntentStatement["kind"], string> = {
  goal: "G",
  observation: "OBS",
  hypothesis: "H",
  constraint: "C",
  invariant: "INV",
  risk: "RISK",
  verification: "V",
  done: "DONE"
};

function scalar(value: Scalar): string {
  if (typeof value === "string") return /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value) ? value : JSON.stringify(value);
  if (value === null) return "null";
  return String(value);
}

export function renderCompact(program: IntentProgram): string {
  if (program.semantics && (program.semantics.entities.length || program.semantics.operations.length)) {
    throw new Error("compact Intent syntax cannot represent canonical semantics yet");
  }
  if (program.unresolved?.length) {
    throw new Error("cannot render compact Intent while unresolved references remain");
  }
  return program.statements.map((s) => {
    const body = s.propositions.map((p) => p.value === undefined ? p.path : `${p.path}=${scalar(p.value)}`).join("\n  ");
    const confidence = s.confidence === undefined ? "" : `^${s.confidence}`;
    return `${TOKEN[s.kind]}{\n  ${body}\n}${confidence}`;
  }).join("\n\n");
}
