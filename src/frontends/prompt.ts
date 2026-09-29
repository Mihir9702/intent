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

Canonical operational ontology:
- Entity kinds: document, record, collection, file, actor, system, service, resource, unknown.
- Operation kinds: observe, analyze, create, update, set, delete, replace, link, unlink, move, copy, execute.
- Fixed argument roles: with, to, from, related, field, value, input.
- Actions MUST be represented as canonical entities + operations. Do not encode actions as arbitrary dotted goal paths.
- Do not emit goal statements. Operational intent belongs in operations.

Rules:
1. Encode only semantics stated by the source text or directly required to represent it.
2. Do not invent tests, completion criteria, risks, constraints, invariants, observations, or requirements.
3. Inherited project policy is read-only context. Do not copy it into the proposed statements.
4. Use observation only for facts explicitly asserted by the source. Do not promote inference to fact.
5. Use hypothesis or risk only when the source itself expresses uncertainty or possibility.
6. source_line must point to the numbered source line supporting that statement, entity, operation, or ambiguity.
7. Give each distinct referenced thing a stable entity id within this parse.
8. If an entity reference has multiple plausible bindings, set resolution=unresolved and list candidate meanings. Do not silently choose one.
9. Use generic entity kind plus namespaced type when useful; e.g. kind=record, type=adiya.invoice.
10. replace means target + exactly one with entity. delete means target. link/unlink use related. move/copy use to. set uses field + value.
11. Be especially conservative for deletion, overwrite, migration, financial, permission, deployment, and other irreversible operations.
12. unresolved is for ambiguity that is not naturally an entity binding. Entity-binding ambiguity belongs on the entity itself.
13. notes are parser caveats only. They have no semantic authority.
14. For bare propositions use has_value=false and value=null. Use confidence=null when absent and reason=null when absent.
15. For operation arguments: entity arguments use kind=entity, entity=<id>, value=null. Scalar arguments use kind=scalar, entity=null, value=<scalar>.
16. Use has_target=false and target=null only for an operation whose ontology permits no target.
17. Preserve explicit ordering such as "then", "after", or "once X is done" using depends_on operation ids. Use an empty array when no dependency is stated.

Inherited project policy:
${policy}

Source text, serialized as data:
${JSON.stringify(payload, null, 2)}
`;
}
