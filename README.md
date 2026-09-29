# Intent

**Intent** is an experimental typed intermediate representation for human–AI software development.

The premise: consequential natural-language instructions should not flow directly into an execution-capable agent. A probabilistic frontend may propose meaning, but deterministic code owns structure, canonical operations, project invariants, ambiguity checks, and type validation.

> AI interprets. Intent represents. Deterministic code validates. Tools execute. Independent evidence verifies.

## Intent language v0.3

v0.3 introduces the **Canonical Intent Ontology**.

Operational intent is no longer represented by provider-invented dotted paths such as:

```text
replacement.source
replacement.replacement
replacement.new_document
```

Instead it uses a closed core vocabulary:

```text
replace(target=@old_document, with=@corrected_version)
delete(target=@old_one) after replace_document
```

Providers may choose different words while parsing English, but the canonical AST must use the same entities, verbs, argument roles, and dependencies.

## Core ontology

Entity kinds are intentionally broad:

```text
document  record  collection  file
actor     system  service     resource  unknown
```

Domain meaning is carried by optional **namespaced types** such as:

```text
adiya.invoice
adiya.customer_po
git.branch
application.pdf
```

Canonical operation verbs are:

```text
observe analyze create update set delete
replace link unlink move copy execute
```

Argument roles are fixed by operation signatures. For example, `replace` requires exactly a target and a `with` entity. An invented role such as `source` is rejected.

See [docs/ONTOLOGY.md](docs/ONTOLOGY.md).

## Canonical JSON

JSON is the lossless interoperability representation:

```json
{
  "version": "0.3",
  "statements": [],
  "semantics": {
    "ontology": "intent-core/0.1",
    "entities": [
      { "id": "old_document", "kind": "document", "resolution": "resolved" },
      { "id": "corrected_version", "kind": "document", "resolution": "resolved" }
    ],
    "operations": [
      {
        "id": "replace_document",
        "kind": "replace",
        "target": "old_document",
        "arguments": [
          { "role": "with", "entity": "corrected_version" }
        ],
        "dependsOn": []
      }
    ]
  }
}
```

Canonical JSON can be saved as `.intent.json`, reloaded, validated, explained, and compiled without another model call.

## Local commands

```bash
npm install
npm test

node dist/src/cli.js validate examples/canonical-replace.intent.json
node dist/src/cli.js explain examples/canonical-replace.intent.json
node dist/src/cli.js compile examples/canonical-replace.intent.json --target claude

node dist/src/cli.js validate examples/ambiguous-replace-delete.intent.json
```

The last command intentionally fails: `delete_old` references unresolved entity `old_one`.

Compact `.intent` remains useful for statement/policy files such as constraints and invariants. It intentionally refuses to serialize canonical operation semantics because silently dropping those operations would be unsafe.

## Project policy

```intent
C{permission_checks.enforcement=server_side}

INV{
  financial_history.rewrite=never
  historical_documents.mutable=false
}
```

Use `--inherit policy.intent` to apply stable project constraints and invariants to a task.

## Semantic frontends and usage

Intent includes adapters for Claude Code and Codex. They are **probabilistic parsers only**: their output must conform to the strict semantic-draft schema and then pass deterministic validation.

```bash
node dist/src/cli.js translate task.txt --via codex --format json
node dist/src/cli.js translate task.txt --via claude --model opus --format json
```

**These `translate --via ...` commands call the selected provider and consume that provider's usage.** Parser, compiler, schema, renderer, and test commands are local and do not consume Claude or Codex model usage.

Semantic frontends cannot emit operational `goal` paths in v0.3. They must emit canonical entities and operations. Explicit ordering such as “then” is represented with operation dependencies.

## Trust boundary

Intent does not make a model smarter. It is intended to make ambiguity, type incompatibility, invented ontology, operation ordering, and project-rule violations visible before execution.

The current design deliberately separates:

1. probabilistic interpretation,
2. canonical representation,
3. deterministic structural/type validation,
4. target-specific compilation,
5. independent execution evidence.
