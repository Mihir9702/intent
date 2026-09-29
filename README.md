# Intent

**Intent** is an experimental typed intermediate representation for human–AI software development.

Natural-language instructions are expressive, but they are also ambiguous. Intent inserts a machine-checkable layer between what a person asks for and what an execution-capable AI agent receives.

> **AI interprets. Intent represents. Deterministic code validates. Tools execute. Independent evidence verifies.**

**Current status:** package `v0.4.0` · Intent language `v0.3` · core ontology `intent-core/0.1` · 31 deterministic tests

Intent is experimental. It is not yet a production safety boundary or a replacement for tests, code review, authorization, or human judgment.

## Why Intent?

A coding instruction such as:

```text
Replace the old document with the corrected version, then delete the old one.
```

contains more uncertainty than it appears to.

What is “the old one”? The original document that was retained, or the document now occupying the original location after replacement?

A capable model may silently choose. Intent is designed to make that ambiguity explicit **before execution**.

## How it works

```text
Natural language
      │
      ▼
Probabilistic semantic frontend
      │
      ▼
Strict semantic draft
      │
      ▼
Deterministic normalizer
      │
      ▼
Canonical Intent AST
      │
      ├── schema validation
      ├── canonical ontology type checking
      ├── operation dependency checking
      ├── inherited project invariants
      └── ambiguity/conflict diagnostics
      │
      ▼
Target compiler
      │
      ▼
Execution-capable agent
      │
      ▼
Independent verification
```

The AI is allowed to **propose meaning**. It does not get to invent the language, approve its own interpretation, or bypass deterministic validation.

## Canonical Intent Ontology

Intent v0.3 represents operational meaning with typed **entities** and **operations**.

Models are not allowed to invent operational paths such as:

```text
replacement.source
replacement.replacement
replacement.new_document
```

Instead, equivalent meaning must normalize to the same canonical form:

```text
@old_document       <document>
@corrected_version  <document>

replace_document:
  replace @old_document with @corrected_version
```

The core operation vocabulary is intentionally small:

```text
observe  analyze  create  update  set  delete
replace  link     unlink  move    copy execute
```

Argument roles are defined by operation signatures. For example, `replace` requires a target and exactly one `with` entity.

Entity kinds stay broad and portable:

```text
document  record  collection  file
actor     system  service     resource  unknown
```

Projects can add domain meaning through namespaced types without changing the core verbs:

```text
adiya.invoice
adiya.customer_po
git.branch
application.pdf
```

See [docs/ONTOLOGY.md](docs/ONTOLOGY.md) for the complete current ontology and type rules.

## Example: ambiguity stays visible

The original sentence can normalize to:

```text
Canonical entities
- @old_document <document>
- @corrected_version <document>
- @old_one <document> [unresolved]

Canonical operations
- replace_document: replace @old_document (with=@corrected_version)
- delete_old: delete @old_one after=[replace_document]
```

Validation then blocks the destructive operation:

```text
ERROR E403:
operation 'delete_old' references unresolved entity 'old_one'
```

## Canonical JSON

Canonical JSON is the lossless interoperability format.

```json
{
  "version": "0.3",
  "statements": [],
  "semantics": {
    "ontology": "intent-core/0.1",
    "entities": [
      {
        "id": "old_document",
        "kind": "document",
        "resolution": "resolved"
      },
      {
        "id": "corrected_version",
        "kind": "document",
        "resolution": "resolved"
      }
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

Canonical programs can be saved as `.intent.json`, reviewed, reloaded, validated, explained, and compiled later **without another model call**.

Compact `.intent` syntax remains useful for human-authored policy and statement files. It intentionally refuses to serialize canonical operation graphs until it can do so losslessly.

## Quick start

Requirements:

- Node.js
- npm
- TypeScript is installed locally as a development dependency

Install and verify:

```powershell
cd C:\Users\Mihir\Desktop\intent
npm install
npm test
```

Expected current result:

```text
tests 31
pass 31
fail 0
```

Validate a resolved canonical program:

```powershell
node dist\src\cli.js validate examples\canonical-replace.intent.json
```

Expected:

```text
PASS — no diagnostics
```

Inspect it in readable form:

```powershell
node dist\src\cli.js explain examples\canonical-replace.intent.json
```

Compile it for the Claude-oriented XML target:

```powershell
node dist\src\cli.js compile examples\canonical-replace.intent.json --target claude
```

Now validate the intentionally ambiguous example:

```powershell
node dist\src\cli.js validate examples\ambiguous-replace-delete.intent.json
```

Expected:

```text
ERROR E403: operation 'delete_old' references unresolved entity 'old_one'
```

## Project policy

Stable project rules can live in separate compact Intent files.

```intent
C{
  permission_checks.enforcement=server_side
}

INV{
  financial_history.rewrite=never
  historical_documents.mutable=false
}
```

Apply policy with `--inherit`:

```powershell
node dist\src\cli.js validate examples\customer-po.intent --inherit examples\project.intent
```

Only constraints and invariants are inherited. Goals, observations, and operational semantics from policy files are not silently imported into the task.

## Semantic frontends

Intent currently includes adapters for:

- Claude Code
- Codex

They act as **probabilistic semantic parsers**, not as the authority.

A frontend must emit a strict draft containing:

- canonical entities;
- canonical operations;
- non-operational statements;
- unresolved ambiguity;
- source-line provenance.

Operational `goal` paths are rejected from semantic frontend output in Intent v0.3.

Example:

```powershell
node dist\src\cli.js translate task.txt --via codex --format json
node dist\src\cli.js translate task.txt --via claude --model opus --format json
```

> **Usage warning:** `translate --via ...` calls the selected AI provider and consumes that provider's model usage when inference succeeds. Parsing, validation, schema generation, rendering, compilation, and the test suite are local and do not consume Claude or Codex model usage.

Provider/model availability depends on the authenticated account and CLI. A model name being accepted in local configuration does not guarantee that the provider will permit inference with that account.

## What the type system checks

The current deterministic ontology layer checks, among other things:

- unresolved entities referenced by operations;
- unknown entity and operation references;
- invalid or provider-invented argument roles;
- missing required operation arguments;
- entity-vs-scalar argument mismatches;
- incompatible replacement types;
- namespaced domain-type syntax;
- unknown/self operation dependencies;
- operation dependency cycles;
- source provenance bounds;
- inherited project invariants.

When replacement compatibility cannot be proven from available type information, Intent warns instead of pretending compatibility is known.

## Repository structure

```text
docs/
  ARCHITECTURE.md
  LANGUAGE.md
  ONTOLOGY.md

examples/
  *.intent
  *.intent.json

schema/
  intent.schema.json
  semantic-draft.schema.json

src/
  ontology/
  frontends/
  renderers/
  cli.ts
  validator.ts

tests/
scripts/
```

## Design boundaries

Intent is intentionally conservative about what it claims.

It does **not** currently:

- prove arbitrary business logic;
- guarantee that a model interpreted English correctly;
- replace application permissions or authorization;
- prove that generated code satisfies the specification;
- make execution safe merely because a program type-checks;
- provide a complete ontology for every software domain.

Its purpose is narrower: move important meaning out of unvalidated prose and into an inspectable, typed representation where known classes of ambiguity and inconsistency can be rejected deterministically.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Intent language](docs/LANGUAGE.md)
- [Canonical Intent Ontology](docs/ONTOLOGY.md)
- [Canonical JSON Schema](schema/intent.schema.json)
- [Semantic Draft Schema](schema/semantic-draft.schema.json)

## Development

Regenerate the semantic-draft schema:

```powershell
npm run schema:generate
```

Run the complete local verification suite:

```powershell
npm run check
```

Current verified checkpoint:

```text
package:        0.4.0
language:       0.3
core ontology:  intent-core/0.1
tests:          31 passing
```

Intent is under active development. The next useful milestone is to evaluate the canonical representation against a larger set of real software-development instructions and measure whether it reduces missed constraints, silent assumptions, and model-to-model semantic drift.
