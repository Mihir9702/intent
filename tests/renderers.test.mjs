import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../dist/src/parser.js";
import { CORE_ONTOLOGY } from "../dist/src/ontology/model.js";
import { renderClaude } from "../dist/src/renderers/claude.js";
import { renderCodex } from "../dist/src/renderers/codex.js";
import { renderCompact } from "../dist/src/renderers/compact.js";
import { renderEnglish } from "../dist/src/renderers/english.js";

const program = parseIntent(`G{invoice.fix}\nINV{history.rewrite=never}\nV{pdf.snapshot}\nDONE{tests=pass}`);

test("renders Claude XML", () => {
  const output = renderClaude(program);
  assert.match(output, /<intent version="0\.3">/);
  assert.match(output, /<invariants>/);
  assert.match(output, /history\.rewrite = &quot;never&quot;|history\.rewrite = "never"/);
});

test("round-trips statement-only programs through compact syntax", () => {
  const reparsed = parseIntent(renderCompact(program));
  assert.deepEqual(
    reparsed.statements.map((s) => s.kind),
    program.statements.map((s) => s.kind)
  );
});

test("renders canonical semantics without losing operation meaning", () => {
  const semanticProgram = {
    ...program,
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "old_document", kind: "document", label: 'Old "Document"', resolution: "resolved" },
        { id: "corrected_version", kind: "document", resolution: "resolved" }
      ],
      operations: [{
        id: "replace_document",
        kind: "replace",
        target: "old_document",
        arguments: [{ role: "with", entity: "corrected_version" }],
        dependsOn: []
      }]
    }
  };

  const xml = renderClaude(semanticProgram);
  assert.match(xml, /<canonical_semantics ontology="intent-core\/0\.1">/);
  assert.match(xml, /kind="replace" target="old_document"/);
  assert.match(xml, /role="with" entity="corrected_version"/);
  assert.match(xml, /label="Old &quot;Document&quot;"/);

  const english = renderEnglish(semanticProgram);
  assert.match(english, /replace @old_document \(with=@corrected_version\)/);
  assert.throws(
    () => renderCompact(semanticProgram),
    /cannot represent canonical semantics/
  );
});

test("renders Codex markdown specification", () => {
  const semanticProgram = {
    ...program,
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "old_document", kind: "document", label: "Old Document", resolution: "resolved" },
        { id: "corrected_version", kind: "document", resolution: "resolved" }
      ],
      operations: [{
        id: "replace_document",
        kind: "replace",
        target: "old_document",
        arguments: [{ role: "with", entity: "corrected_version" }],
        dependsOn: []
      }]
    }
  };

  const md = renderCodex(semanticProgram);
  assert.match(md, /# Intent Execution Specification \(v0\.3\)/);
  assert.match(md, /\*\*Ontology\*\*: `intent-core\/0\.1`/);
  assert.match(md, /## Invariants \(Non-negotiable Rules\)/);
  assert.match(md, /`history\.rewrite` = "never"/);
  assert.match(md, /## Canonical Entities/);
  assert.match(md, /`@old_document` <`document`> "Old Document"/);
  assert.match(md, /## Operation Plan/);
  assert.match(md, /\*\*`\[replace_document\]`\*\* `replace` on `@old_document` \(with=`@corrected_version`\)/);
  assert.match(md, /Destructive: yes/);
  assert.match(md, /## Completion Criteria/);
  assert.match(md, /`tests` = "pass"/);
});
