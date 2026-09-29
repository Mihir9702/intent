# Intent

**Intent** is an experimental typed intermediate representation for human–AI software development.

The premise is simple: consequential natural-language instructions should not flow directly into an execution-capable coding agent. A semantic frontend proposes a small, inspectable AST; deterministic code validates project policy and ambiguity; then a target adapter compiles the accepted Intent for Claude, Codex, Gemini, or another agent.

> AI interprets. Intent represents. Deterministic code validates. Tools execute. Independent evidence verifies.

## v0.2 core

The current repository implements the deterministic layer:

- compact `.intent` syntax
- canonical TypeScript AST
- handwritten structural validation
- semantic diagnostics
- first-class unresolved references
- project-level inherited constraints and invariants
- source provenance in diagnostics
- English explanation / reverse rendering
- Claude-oriented XML compilation
- canonical JSON compilation
- compact round-trip rendering
- Node built-in test coverage

English → Intent remains behind a pluggable probabilistic frontend. Its output is never trusted until it passes the same validator.

## Example

```intent
G{
  CPO.remove_line
  SalesOrder.remove_linked_line
}

C{
  operation.transaction=PURCHASE_ORDER_UPDATE
}

V{
  SalesOrder.remaining_lines
  transaction.rollback
}

DONE{
  tests=pass
  regression=none
}
```

Project policy can live separately:

```intent
INV{
  financial_history.rewrite=never
  historical_documents.mutable=false
}

C{
  permission_checks.enforcement=server_side
}
```

Then validate the task with that policy inherited:

```bash
npm install
npm test

node dist/src/cli.js validate examples/customer-po.intent \
  --inherit examples/project.intent

node dist/src/cli.js explain examples/customer-po.intent \
  --inherit examples/project.intent

node dist/src/cli.js compile examples/customer-po.intent \
  --inherit examples/project.intent \
  --target claude
```

`--inherit` may be repeated. Only constraints and invariants are inherited; goals and observations from policy files are deliberately ignored.

## Ambiguity

A semantic frontend may attach unresolved references to the canonical AST. Any unresolved reference produces compiler error `E301`. Destructive ambiguity is therefore represented, not guessed.

Compact `.intent` syntax intentionally cannot serialize unresolved references yet. JSON is the canonical interoperability format.

## Trust boundary

Intent does **not** make a model smarter. It attempts to make instructions more explicit, disagreements inspectable, and dangerous ambiguity compiler-visible.

The next layer is a local semantic frontend that asks an existing coding model to propose canonical Intent, then runs the deterministic validator before the result can be compiled for execution.

## Semantic frontends

Intent can now ask an installed coding model to propose a semantic draft, then normalize and validate it before anything is compiled for execution.

```bash
# Claude Code
node dist/src/cli.js translate examples/ambiguous.txt \
  --via claude --model opus --format explain

# Codex
node dist/src/cli.js translate examples/ambiguous.txt \
  --via codex --format explain
```

The frontend runs as a parser, not as an implementation agent. It is instructed not to invent tests, completion criteria, invariants, or other requirements. Source lines are preserved, project policy is read-only context, and ambiguous references remain explicit.

The structured draft schema is intentionally stricter than the canonical Intent AST so it works with schema-constrained model outputs across providers. Bare propositions use an explicit `has_value=false` marker instead of relying on an omitted property.

A deliberately ambiguous example:

```text
Replace the old document with the corrected version, then delete the old one.
```

was live-tested through the local Codex CLI. Codex represented the requested operations but left “the old one” unresolved; deterministic validation then blocked compilation with `E301`.

The Claude adapter is implemented and fixture-tested. A live Claude run on this machine currently reaches the provider but is blocked by the account's usage limit before inference.
