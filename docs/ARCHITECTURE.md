# Intent Architecture

```text
Natural language
      |
      v
Probabilistic semantic frontend
      |
      v
Strict Semantic Draft
  - canonical entity proposals
  - canonical operation proposals
  - statements
  - unresolved ambiguity
      |
      v
Deterministic normalizer
      |
      v
Canonical Intent AST
      |
      +--> AST shape validation
      +--> Canonical Ontology type checking
      +--> operation dependency checking
      +--> project invariant validation
      +--> ambiguity/conflict diagnostics
      |
      v
Target compiler
  |       |       |
Claude   Codex   future adapters
      |
      v
Execution-capable agent
      |
      v
Independent verification
```

## Trust boundary

The semantic frontend is probabilistic and non-authoritative.

It cannot create new operation verbs or argument roles. It can only map source language into the canonical vocabulary accepted by the deterministic compiler.

The normalizer attaches source provenance and converts the strict provider schema into the canonical AST.

The deterministic layers decide whether the result is structurally valid, type-compatible, sufficiently resolved, and permitted by inherited project policy.

> AI interprets. Intent represents. Deterministic code validates. Tools execute. Independent evidence verifies.

## Why two schemas exist

The **semantic-draft schema** is optimized for constrained model output. Every object property is required so providers with strict structured-output requirements can enforce it. Null/boolean markers represent optional semantics explicitly.

The **canonical Intent AST** is optimized for software interoperability and source control. Optional information is represented normally.

This separation prevents provider-specific schema restrictions from contaminating the language itself.

## Why compact syntax is not the operational IR

Compact `.intent` is useful for human-authored policy and epistemic statements.

Canonical operation graphs use JSON because they contain entity bindings, typed arguments, and dependencies. Until compact syntax can represent all of that losslessly, its renderer refuses semantic programs rather than dropping information.

## Provider independence

A provider may internally describe the source in different language:

```text
replacement.source
replacement.replacement
new_document
replacement.input
```

None of those labels are canonical.

The normalized result must instead be equivalent to:

```text
entity old_document       : document
entity corrected_version  : document

operation replace_document:
  replace old_document with corrected_version
```

This is the main architectural purpose of the Canonical Intent Ontology.

## Current trust layers

1. **Source parsing** — compact syntax or canonical JSON.
2. **Draft schema** — bounds probabilistic frontend output.
3. **Normalization** — converts provider schema to canonical AST.
4. **AST shape** — verifies runtime structure.
5. **Ontology types** — verifies entities, verbs, roles, and compatibility (including hierarchical subtyping).
6. **Dependency graph** — validates explicit operation ordering and rejects cycles.
7. **Project policy** — inherited constraints and invariants with universal, prefix, and hierarchical matching.
8. **Ambiguity** — unresolved references remain compiler-visible.
9. **Abstract state simulation** — topological lifecycle simulation to catch temporal hazards (use-after-delete, use-before-create, double-create).
10. **Target adapter** — produces model/provider-specific execution prompts (Claude structured XML or Codex markdown specifications).
11. **Runtime process supervision** — live execution mediation and real-time evidence collection.
12. **Independent verification** — closed-loop evidence checking and cryptographically signed audit certificates.
