# Intent Language v0.3

Intent is a typed intermediate representation for human–AI software development.

The canonical program may contain three semantic layers:

1. **canonical semantics** — typed entities and operations;
2. **statements** — observations, hypotheses, constraints, invariants, risks, verification, and completion conditions;
3. **unresolved references** — remaining ambiguity that cannot yet be bound safely.

Canonical JSON is the lossless interchange format.

## Canonical operations

Operational instructions belong under `semantics.operations`, not arbitrary dotted goal paths.

```json
{
  "semantics": {
    "ontology": "intent-core/0.1",
    "entities": [],
    "operations": []
  }
}
```

See [ONTOLOGY.md](ONTOLOGY.md) for operation signatures and type rules.

## Compact statement syntax

Compact `.intent` remains a human-friendly statement/policy syntax:

| Token | Meaning |
|---|---|
| `G` | legacy/manual goal |
| `OBS` | established observation |
| `H` | hypothesis |
| `C` | constraint |
| `INV` | invariant |
| `RISK` | risk |
| `V` | verification requirement |
| `DONE` | completion condition |

Example:

```intent
OBS{invoice.customer_blank=true}
H{serializer.omits_customer=true}^.73

C{existing_invoice_schema=preserve}
INV{financial_history.rewrite=never}

V{invoice_pdf.snapshot}
DONE{tests=pass}
```

Compact syntax cannot currently serialize canonical operations. The renderer refuses rather than silently dropping them.

## Values and confidence

Statements support string, number, boolean, and null scalar values.

Confidence is permitted only on hypotheses and risks and must be between 0 and 1.

## Semantic frontend contract

A semantic frontend is not allowed to define the operational vocabulary.

Its structured draft must provide:

- canonical entities;
- canonical operations;
- non-operational statements;
- remaining non-entity ambiguity;
- parser notes.

Operational `goal` statements are rejected from semantic frontend output in v0.3.

Explicit ordering must be preserved using operation dependencies.

## Inherited policy

Project policy may be authored as ordinary compact Intent files:

```intent
C{permission_checks.enforcement=server_side}
INV{financial_history.rewrite=never}
```

When used with `--inherit`, only constraints and invariants are imported from policy files. Goals, observations, and project operations are not inherited into the task.

## Validation layers

v0.3 validation includes:

1. canonical AST structural validation;
2. statement scalar/confidence validation;
3. conflicting observation/invariant checks;
4. direct legacy goal/invariant conflict checks (E201);
5. canonical operation invariant enforcement (E202);
6. unresolved-reference blocking;
7. canonical entity/reference validation;
8. canonical operation signature checking;
9. operation argument entity/scalar type checking;
10. replacement compatibility checking;
11. operation dependency validation and cycle detection;
12. project policy inheritance;
13. warnings for missing verification or completion conditions.

The compiler still does **not** claim to prove arbitrary logical equivalence or domain business rules. Those require explicit deterministic rules.
