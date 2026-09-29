# Intent Architecture

```text
Natural language
      |
      v
Probabilistic semantic frontend
      |
      v
Canonical Intent AST
      |
      +--> deterministic schema validation
      +--> project/domain invariant validation
      +--> ambiguity/conflict diagnostics
      |
      v
Target compiler
  |       |       |
Claude   Codex   Gemini
      |
      v
Execution-capable agent
      |
      v
Independent verification
```

## Trust boundary

The semantic frontend is allowed to be probabilistic. It is not authoritative.

A frontend may propose an AST, but the deterministic compiler decides whether the AST is structurally valid and whether known invariants permit compilation.

> AI interprets. Intent represents. Deterministic code validates. Tools execute. Independent evidence verifies.

## Why compact syntax is not the IR

The `.intent` syntax exists for humans and source control. The canonical AST is the interoperability boundary. Other serializations or graphical editors may produce the same AST without using compact syntax at all.

## Planned trust layers

1. **Syntax** — parser correctness.
2. **Shape** — canonical AST schema.
3. **Semantics** — cross-statement conflicts and invariants.
4. **Domain rules** — project-specific rules such as immutable financial history.
5. **Ambiguity** — unresolved references from natural language remain explicit rather than guessed.
6. **Target adapter** — compilation for a specific model/provider.
7. **Evidence** — tests and independent review establish completion.
