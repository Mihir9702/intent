# Canonical Intent Ontology v0.1

The Canonical Intent Ontology is the provider-independent operational layer introduced with Intent language v0.3.

Its purpose is to prevent different semantic frontends from inventing different machine meanings for the same action.

## Design principle: closed verbs, open types

The **operation vocabulary is closed and small**. Core verbs such as `replace`, `delete`, `link`, and `set` have deterministic signatures.

The **domain type vocabulary is open and namespaced**. A project can describe a record as `adiya.invoice` without adding an `invoice.delete` verb to the core language.

This keeps the core ontology stable while allowing domain-specific nouns.

## Entity model

Every distinct referenced thing has a stable id within a program:

```json
{
  "id": "invoice",
  "kind": "record",
  "type": "adiya.invoice",
  "label": "Invoice 2514008",
  "resolution": "resolved"
}
```

`kind` is coarse and portable. `type` is optional and domain-specific.

`resolution` describes whether the reference binding is known. It does **not** mean the real-world object already exists. A future object to be created can still have a resolved identity.

## Core entity kinds

| Kind | Meaning |
|---|---|
| `document` | Human/business document as a semantic artifact |
| `record` | Structured application or database record |
| `collection` | Container/group/folder-like semantic object |
| `file` | Concrete file/blob |
| `actor` | Person, organization, or acting identity |
| `system` | Software/hardware system |
| `service` | Callable service or endpoint |
| `resource` | Other actionable resource |
| `unknown` | Type not yet known well enough |

Namespaced types must contain a namespace separator:

```text
adiya.invoice       valid
git.branch          valid
application.pdf     valid
invoice             invalid as a domain type
```

The coarse kind remains available even when no subtype is known.

## Canonical operation signatures

| Operation | Required meaning |
|---|---|
| `observe` | inspect target without changing it |
| `analyze` | analyze target, optional repeated `input` entities |
| `create` | create the target identity, optional `input` entities |
| `update` | update target, optional `input` entities |
| `set` | target + scalar `field` + scalar `value` |
| `delete` | delete target |
| `replace` | target + entity `with` |
| `link` | target + entity `related` |
| `unlink` | target + entity `related` |
| `move` | target + entity `to` |
| `copy` | target + entity `to` |
| `execute` | execute target, optional repeated `input` entities |

An operation cannot invent argument roles. For example:

```json
{
  "id": "replace_document",
  "kind": "replace",
  "target": "old_document",
  "arguments": [
    { "role": "with", "entity": "corrected_version" }
  ],
  "dependsOn": []
}
```

is canonical.

This is not:

```json
{
  "kind": "replace",
  "arguments": [
    { "role": "source", "entity": "corrected_version" }
  ]
}
```

`source` is not part of the `replace` signature and is rejected deterministically.

## Ordering

Operations may declare explicit dependencies:

```json
{
  "id": "delete_old",
  "kind": "delete",
  "target": "old_one",
  "arguments": [],
  "dependsOn": ["replace_document"]
}
```

This preserves source language such as “then,” “after,” and “once X is done.”

The type checker rejects self-dependencies, references to unknown operation ids, and dependency cycles.

## Type compatibility

`replace` currently requires the replacement entity to be assignable to the target.

Compatibility rules are intentionally conservative:

1. Different core kinds are incompatible.
2. Same core kind + equal explicit namespaced type is compatible.
3. Same core kind + conflicting explicit types is incompatible.
4. If only one side has a subtype, compatibility is unknown rather than assumed.
5. `unknown` core kinds also produce unknown compatibility.

Unknown compatibility produces a warning. Proven incompatibility produces an error.

This distinction matters: lack of evidence should not be silently converted into certainty.

## Ambiguous references

Entity ambiguity belongs on the entity:

```json
{
  "id": "old_one",
  "kind": "document",
  "resolution": "unresolved",
  "candidates": [
    "original old document retained separately after replacement",
    "document at the replaced location after replacement"
  ]
}
```

Any operation that references this entity is blocked.

This is how:

```text
Replace the old document with the corrected version,
then delete the old one.
```

can preserve both the requested ordering and the unresolved meaning of “old one” without guessing.

## Relationship to statements

Canonical operations represent **what is to happen**.

Intent statements still represent other semantic layers:

- observations,
- hypotheses,
- constraints,
- invariants,
- risks,
- verification requirements,
- completion conditions.

Compact `.intent` also retains legacy `G{}` goals for manually authored statement-oriented files, but semantic frontends in v0.3 are forbidden from using arbitrary `goal` paths for operations.

## Type-checker diagnostics

Important ontology diagnostics include:

| Code | Meaning |
|---|---|
| `E403` | operation references unresolved entity |
| `E408` | unknown target |
| `E409` | operation received an unsupported argument role |
| `E411` | entity/scalar argument type mismatch |
| `E412` | unknown entity argument |
| `E414` | required operation argument missing |
| `E415` | replacement entity is provably incompatible |
| `E424` | operation depends on itself |
| `E425` | unknown operation dependency |
| `E426` | dependency cycle |
| `E427` | domain entity type is not namespaced |
| `W402` | replacement compatibility cannot be proven |

## Non-goals

v0.1 of the ontology does not attempt to encode every programming operation, prove arbitrary business logic, or infer domain relationships automatically.

It establishes a small semantic contract that can be extended only when concrete examples demonstrate that the core vocabulary is insufficient.
