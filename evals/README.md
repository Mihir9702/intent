# Intent Benchmark Evaluation Suite

This evaluation suite tests the deterministic guarantees of Intent v0.3 across common real-world software engineering instruction scenarios.

## Principles

1. **Deterministic Verification**: Every scenario is evaluated locally without calling probabilistic model APIs.
2. **Ambiguity Visibility**: Ambiguous entity bindings must stay visible and block destructive operations (`E403`).
3. **Invariant Protection**: Operational semantics must respect project invariants (`E202`).
4. **Type Safety**: Unchecked or incompatible type replacements must be rejected (`E415`).
5. **Cycle Detection**: Operational dependency cycles must be caught before execution (`E426`).
6. **Cross-Compiler Consistency**: Valid programs must compile deterministically to both Claude (`--target claude`) and Codex (`--target codex`).

## Scenarios

| ID | Scenario | Tested Rule | Expected Outcome |
|---|---|---|---|
| `EVAL-01` | Ambiguous Entity Binding | Deletion depends on unresolved reference | Block (`E403`) |
| `EVAL-02` | Immutable Historical Document | Deletion of invariant-protected record | Block (`E202`) |
| `EVAL-03` | Incompatible Type Replacement | Record replaced with raw PDF file | Block (`E415`) |
| `EVAL-04` | Migration Dependency Cycle | Cyclic operation dependencies | Block (`E426`) |
| `EVAL-05` | Verified Canonical Replacement | Complete resolved task with policy | Pass (`Claude` + `Codex` target output) |
| `EVAL-06` | Hierarchical Subtyping | Replacement with specialized subtype (`invoice.vat`) | Pass (Subtype compatible) |
| `EVAL-07` | Unlink Argument Invariant | Unlinking entity from protected audit log argument | Block (`E202`) |
| `EVAL-08` | Non-Executable Target | Executing non-executable entity kind (`document`) | Block (`E417`) |
| `EVAL-09` | Conflicting Constraints | Mutually contradictory security constraints | Block (`E117`) |
| `EVAL-10` | Universal Invariant Protection | Deletion blocked by universal wildcard (`*.delete=never`) | Block (`E202`) |
| `EVAL-11` | Closed-Loop Evidence Verification | Execution evidence matches verification requirements | Pass (Audit Certificate generated) |
| `EVAL-12` | Evidence Detects Invariant Violation | Execution evidence deletes protected log file | Block (Verification failed) |
| `EVAL-13` | Temporal Use-After-Delete Hazard | Operation attempts to modify a deleted entity | Block (`E501`) |
| `EVAL-14` | Temporal Use-Before-Create Hazard | Operation accesses unborn entity before creation | Block (`E502`) |
| `EVAL-15` | Double Creation Hazard | Operation plan contains duplicate creates for same entity | Block (`E504`) |

## Running the Evaluation Suite

```powershell
npm run eval
```
