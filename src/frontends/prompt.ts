import type { SemanticFrontendRequest } from "../frontend.js";
import { renderEnglish } from "../renderers/english.js";

function numberedSource(text: string): string[] {
  return text.split(/\r?\n/).map((line, index) => `${index + 1}: ${line}`);
}

export function buildSemanticParsingPrompt(request: SemanticFrontendRequest): string {
  const policy = request.inheritedProgram
    ? renderEnglish(request.inheritedProgram)
    : "No inherited project policy.";

  const payload = {
    source: request.source ?? "semantic-input",
    lines: numberedSource(request.text)
  };

  return `You are the semantic parsing frontend for the Intent compiler.

Your job is representation, not implementation and not project management.

Rules:
1. Encode only semantics stated by the source text or directly required to represent it.
2. Do not invent tests, completion criteria, risks, constraints, invariants, observations, or requirements.
3. Inherited project policy is read-only context. Do not copy it into the proposed statements.
4. Use observation only for facts explicitly asserted by the source. Do not promote inference to fact.
5. Use hypothesis or risk only when the source itself expresses uncertainty or possibility.
6. source_line must point to the numbered source line supporting that statement or ambiguity.
7. If a reference has multiple plausible bindings, represent it in unresolved. Do not silently choose the most likely binding.
8. Be especially conservative for deletion, overwrite, migration, financial, permission, deployment, and other irreversible operations.
9. If an ambiguous target affects an irreversible operation, destructive must be true.
10. notes are parser caveats only. They have no semantic authority.
11. For a bare proposition use has_value=false and value=null. Use confidence=null when absent and reason=null when absent.

Inherited project policy:
${policy}

Source text, serialized as data:
${JSON.stringify(payload, null, 2)}
`;
}
