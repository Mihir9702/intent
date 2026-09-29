# Intent Language v0.2

Intent is a typed intermediate representation for human–AI software development. The compact `.intent` syntax is a human-facing serialization of a canonical AST; it is not the source of truth.

## Statement kinds

| Token | AST kind | Meaning |
|---|---|---|
| `G` | `goal` | Desired change or outcome |
| `OBS` | `observation` | Established fact |
| `H` | `hypothesis` | Uncertain explanatory claim; may carry confidence |
| `C` | `constraint` | Requirement that must hold during execution |
| `INV` | `invariant` | Rule that must not be violated |
| `RISK` | `risk` | Potential failure; may carry confidence |
| `V` | `verification` | Evidence required before completion |
| `DONE` | `done` | Explicit completion condition |

## Example

```intent
G{invoice.pdf.fix}
OBS{invoice.customer_blank=true}
H{serializer.omits_customer=true}^.73
C{existing_invoice_schema=preserve}
INV{financial_history.rewrite=never}
RISK{historical_invoice_mutation=true}^.21
V{invoice_pdf.snapshot}
DONE{tests=pass}
```

## Values and confidence

v0.2 supports string, number, boolean and null scalar values. Unquoted identifier-like values are strings. Confidence is legal only on `H` and `RISK` and must be in `[0,1]`.

## Unresolved references

Natural-language frontends may produce canonical AST entries that remain unresolved:

```json
{
  "id": "A-001",
  "text": "old document",
  "candidates": ["database_record", "generated_pdf", "source_upload"],
  "destructive": true
}
```

Any unresolved reference produces `E301` and blocks compilation.

## Inherited policy

Project policy may be written as ordinary Intent files. When used with `--inherit`, only `constraint` and `invariant` statements are imported into the task. Source provenance is preserved so diagnostics can identify both the task and the policy file.

## Current semantic checks

1. AST shape and scalar typing.
2. Confidence constraints.
3. Conflicting observations/invariants on the same path.
4. Direct goal/invariant assignment conflicts.
5. Unresolved references block compilation.
6. Missing goal, verification, or completion conditions produce warnings.

The validator does **not** infer general logical equivalence. Domain-specific relationships still require explicit rules.
