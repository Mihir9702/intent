import {
  INTENT_VERSION,
  type IntentProgram,
  type IntentStatement,
  type Scalar,
  type StatementKind,
  type UnresolvedReference
} from "./model.js";
import {
  CORE_ONTOLOGY,
  type CanonicalArgument,
  type CanonicalEntity,
  type CanonicalOperation
} from "./ontology/model.js";

export type SemanticStatementKind = Exclude<StatementKind, "goal">;

export interface SemanticDraftProposition {
  path: string;
  has_value: boolean;
  value: Scalar;
}

export interface SemanticDraftStatement {
  kind: SemanticStatementKind;
  propositions: SemanticDraftProposition[];
  confidence: number | null;
  source_line: number;
}

export interface SemanticDraftEntity {
  id: string;
  kind: CanonicalEntity["kind"];
  type: string | null;
  label: string | null;
  resolution: CanonicalEntity["resolution"];
  candidates: string[];
  source_line: number;
}

export interface SemanticDraftArgument {
  role: CanonicalArgument["role"];
  kind: "entity" | "scalar";
  entity: string | null;
  value: Scalar;
}

export interface SemanticDraftOperation {
  id: string;
  kind: CanonicalOperation["kind"];
  has_target: boolean;
  target: string | null;
  arguments: SemanticDraftArgument[];
  depends_on: string[];
  source_line: number;
}

export interface SemanticDraftUnresolved {
  id: string;
  text: string;
  candidates: string[];
  destructive: boolean;
  reason: string | null;
  source_line: number;
}

export interface SemanticDraft {
  entities: SemanticDraftEntity[];
  operations: SemanticDraftOperation[];
  statements: SemanticDraftStatement[];
  unresolved: SemanticDraftUnresolved[];
  notes: string[];
}

const SCALAR_SCHEMA = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" }
  ]
} as const;

export const SEMANTIC_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entities", "operations", "statements", "unresolved", "notes"],
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "type", "label", "resolution", "candidates", "source_line"],
        properties: {
          id: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_.:-]*$" },
          kind: {
            enum: ["document", "record", "collection", "file", "actor", "system", "service", "resource", "unknown"]
          },
          type: {
            anyOf: [
              { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_-]*(?:\\.[A-Za-z_][A-Za-z0-9_-]*)+$" },
              { type: "null" }
            ]
          },
          label: { anyOf: [{ type: "string" }, { type: "null" }] },
          resolution: { enum: ["resolved", "unresolved"] },
          candidates: { type: "array", items: { type: "string" } },
          source_line: { type: "integer", minimum: 1 }
        }
      }
    },
    operations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "has_target", "target", "arguments", "depends_on", "source_line"],
        properties: {
          id: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_.:-]*$" },
          kind: {
            enum: ["observe", "analyze", "create", "update", "set", "delete", "replace", "link", "unlink", "move", "copy", "execute"]
          },
          has_target: { type: "boolean" },
          target: { anyOf: [{ type: "string" }, { type: "null" }] },
          arguments: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["role", "kind", "entity", "value"],
              properties: {
                role: { enum: ["with", "to", "from", "related", "field", "value", "input"] },
                kind: { enum: ["entity", "scalar"] },
                entity: { anyOf: [{ type: "string" }, { type: "null" }] },
                value: SCALAR_SCHEMA
              }
            }
          },
          depends_on: {
            type: "array",
            items: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_.:-]*$" }
          },
          source_line: { type: "integer", minimum: 1 }
        }
      }
    },
    statements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "propositions", "confidence", "source_line"],
        properties: {
          kind: {
            enum: ["observation", "hypothesis", "constraint", "invariant", "risk", "verification", "done"]
          },
          propositions: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "has_value", "value"],
              properties: {
                path: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_.:-]*$" },
                has_value: { type: "boolean" },
                value: SCALAR_SCHEMA
              }
            }
          },
          confidence: {
            anyOf: [
              { type: "number", minimum: 0, maximum: 1 },
              { type: "null" }
            ]
          },
          source_line: { type: "integer", minimum: 1 }
        }
      }
    },
    unresolved: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "candidates", "destructive", "reason", "source_line"],
        properties: {
          id: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
          candidates: { type: "array", items: { type: "string" } },
          destructive: { type: "boolean" },
          reason: {
            anyOf: [
              { type: "string" },
              { type: "null" }
            ]
          },
          source_line: { type: "integer", minimum: 1 }
        }
      }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export class SemanticDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticDraftError";
  }
}

const STATEMENT_KINDS = new Set<SemanticStatementKind>([
  "observation",
  "hypothesis",
  "constraint",
  "invariant",
  "risk",
  "verification",
  "done"
]);

const ENTITY_KINDS = new Set([
  "document", "record", "collection", "file", "actor",
  "system", "service", "resource", "unknown"
]);
const OPERATION_KINDS = new Set([
  "observe", "analyze", "create", "update", "set", "delete",
  "replace", "link", "unlink", "move", "copy", "execute"
]);
const ARGUMENT_ROLES = new Set([
  "with", "to", "from", "related", "field", "value", "input"
]);

const PATH = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const NAMESPACED_TYPE = /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)+$/;

function isScalar(value: unknown): value is Scalar {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function rawProposition(path: string, value: Scalar | undefined): string {
  if (value === undefined) return path;
  return `${path}=${typeof value === "string" ? JSON.stringify(value) : String(value)}`;
}

function validSourceLine(value: unknown, lineCount: number): boolean {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= lineCount;
}

function assertDraft(draft: unknown, lineCount: number): asserts draft is SemanticDraft {
  if (!draft || typeof draft !== "object") {
    throw new SemanticDraftError("semantic frontend returned a non-object");
  }

  const value = draft as Record<string, unknown>;
  if (!Array.isArray(value.entities)) throw new SemanticDraftError("semantic draft entities must be an array");
  if (!Array.isArray(value.operations)) throw new SemanticDraftError("semantic draft operations must be an array");
  if (!Array.isArray(value.statements)) throw new SemanticDraftError("semantic draft statements must be an array");
  if (!Array.isArray(value.unresolved)) throw new SemanticDraftError("semantic draft unresolved must be an array");
  if (!Array.isArray(value.notes) || value.notes.some((note) => typeof note !== "string")) {
    throw new SemanticDraftError("semantic draft notes must be strings");
  }

  for (const entity of value.entities as Record<string, unknown>[]) {
    if (typeof entity.id !== "string" || !PATH.test(entity.id)) {
      throw new SemanticDraftError(`invalid semantic entity id '${String(entity.id)}'`);
    }
    if (!ENTITY_KINDS.has(String(entity.kind))) {
      throw new SemanticDraftError(`invalid semantic entity kind '${String(entity.kind)}'`);
    }
    if (!["resolved", "unresolved"].includes(String(entity.resolution))) {
      throw new SemanticDraftError(`invalid resolution on entity '${entity.id}'`);
    }
    if (
      entity.type !== null &&
      (typeof entity.type !== "string" || !NAMESPACED_TYPE.test(entity.type))
    ) {
      throw new SemanticDraftError(`invalid namespaced type on entity '${entity.id}'`);
    }
    if (entity.label !== null && typeof entity.label !== "string") {
      throw new SemanticDraftError(`invalid label on entity '${entity.id}'`);
    }
    if (!Array.isArray(entity.candidates) || entity.candidates.some((candidate) => typeof candidate !== "string")) {
      throw new SemanticDraftError(`invalid candidates on entity '${entity.id}'`);
    }
    if (!validSourceLine(entity.source_line, lineCount)) {
      throw new SemanticDraftError(`entity '${entity.id}' has source_line outside the input text`);
    }
  }

  for (const operation of value.operations as Record<string, unknown>[]) {
    if (typeof operation.id !== "string" || !PATH.test(operation.id)) {
      throw new SemanticDraftError(`invalid semantic operation id '${String(operation.id)}'`);
    }
    if (!OPERATION_KINDS.has(String(operation.kind))) {
      throw new SemanticDraftError(`invalid semantic operation kind '${String(operation.kind)}'`);
    }
    if (!validSourceLine(operation.source_line, lineCount)) {
      throw new SemanticDraftError(`operation '${operation.id}' has source_line outside the input text`);
    }
    if (typeof operation.has_target !== "boolean") {
      throw new SemanticDraftError(`operation '${operation.id}' requires has_target`);
    }
    if (operation.has_target && typeof operation.target !== "string") {
      throw new SemanticDraftError(`operation '${operation.id}' requires a target id`);
    }
    if (!operation.has_target && operation.target !== null) {
      throw new SemanticDraftError(`operation '${operation.id}' must use null target when has_target=false`);
    }
    if (!Array.isArray(operation.arguments)) {
      throw new SemanticDraftError(`operation '${operation.id}' arguments must be an array`);
    }
    if (!Array.isArray(operation.depends_on) || operation.depends_on.some((id) => typeof id !== "string" || !PATH.test(id))) {
      throw new SemanticDraftError(`operation '${operation.id}' depends_on must contain valid operation ids`);
    }

    for (const argument of operation.arguments as Record<string, unknown>[]) {
      if (!ARGUMENT_ROLES.has(String(argument.role))) {
        throw new SemanticDraftError(`invalid argument role '${String(argument.role)}' on '${operation.id}'`);
      }
      if (argument.kind === "entity") {
        if (typeof argument.entity !== "string" || argument.value !== null) {
          throw new SemanticDraftError(`entity argument on '${operation.id}' must contain entity id and null value`);
        }
      } else if (argument.kind === "scalar") {
        if (argument.entity !== null || !isScalar(argument.value)) {
          throw new SemanticDraftError(`scalar argument on '${operation.id}' must contain null entity and scalar value`);
        }
      } else {
        throw new SemanticDraftError(`invalid argument kind on '${operation.id}'`);
      }
    }
  }

  for (const statement of value.statements as Record<string, unknown>[]) {
    if (!STATEMENT_KINDS.has(statement.kind as SemanticStatementKind)) {
      throw new SemanticDraftError(`invalid semantic statement kind '${String(statement.kind)}'`);
    }
    if (!validSourceLine(statement.source_line, lineCount)) {
      throw new SemanticDraftError(`statement source_line ${String(statement.source_line)} is outside the input text`);
    }
    if (!Array.isArray(statement.propositions) || statement.propositions.length === 0) {
      throw new SemanticDraftError("semantic draft statement requires propositions");
    }
    if (statement.confidence !== null) {
      if (!["hypothesis", "risk"].includes(String(statement.kind))) {
        throw new SemanticDraftError("confidence is only valid on hypothesis or risk");
      }
      if (typeof statement.confidence !== "number" || statement.confidence < 0 || statement.confidence > 1) {
        throw new SemanticDraftError("confidence must be between 0 and 1");
      }
    }

    for (const proposition of statement.propositions as Record<string, unknown>[]) {
      if (typeof proposition.path !== "string" || !PATH.test(proposition.path)) {
        throw new SemanticDraftError(`invalid proposition path '${String(proposition.path)}'`);
      }
      if (typeof proposition.has_value !== "boolean" || !isScalar(proposition.value)) {
        throw new SemanticDraftError(`invalid value encoding on '${proposition.path}'`);
      }
      if (!proposition.has_value && proposition.value !== null) {
        throw new SemanticDraftError(`bare proposition '${proposition.path}' must use null placeholder value`);
      }
    }
  }

  for (const ref of value.unresolved as Record<string, unknown>[]) {
    if (typeof ref.id !== "string" || !ref.id) {
      throw new SemanticDraftError("unresolved reference requires id");
    }
    if (typeof ref.text !== "string" || !ref.text) {
      throw new SemanticDraftError(`unresolved '${String(ref.id)}' requires text`);
    }
    if (!Array.isArray(ref.candidates) || ref.candidates.some((candidate) => typeof candidate !== "string")) {
      throw new SemanticDraftError(`unresolved '${ref.id}' has invalid candidates`);
    }
    if (typeof ref.destructive !== "boolean") {
      throw new SemanticDraftError(`unresolved '${ref.id}' requires destructive boolean`);
    }
    if (ref.reason !== null && typeof ref.reason !== "string") {
      throw new SemanticDraftError(`unresolved '${ref.id}' has invalid reason`);
    }
    if (!validSourceLine(ref.source_line, lineCount)) {
      throw new SemanticDraftError(`unresolved '${ref.id}' has source_line outside the input text`);
    }
  }
}

function normalizeArgument(argument: SemanticDraftArgument): CanonicalArgument {
  return argument.kind === "entity"
    ? { role: argument.role, entity: argument.entity as string }
    : { role: argument.role, value: argument.value };
}

export function normalizeSemanticDraft(
  draft: unknown,
  sourceText: string,
  source = "semantic-input"
): {
  program: IntentProgram;
  notes: string[];
} {
  const lineCount = Math.max(1, sourceText.split(/\r?\n/).length);
  assertDraft(draft, lineCount);

  const entities: CanonicalEntity[] = draft.entities.map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    type: entity.type ?? undefined,
    label: entity.label ?? undefined,
    resolution: entity.resolution,
    candidates: entity.candidates.length ? entity.candidates : undefined,
    source,
    line: entity.source_line
  }));

  const operations: CanonicalOperation[] = draft.operations.map((operation) => ({
    id: operation.id,
    kind: operation.kind,
    target: operation.has_target ? operation.target as string : undefined,
    arguments: operation.arguments.map(normalizeArgument),
    dependsOn: [...operation.depends_on],
    source,
    line: operation.source_line
  }));

  const statements: IntentStatement[] = draft.statements.map((statement) => ({
    kind: statement.kind,
    confidence: statement.confidence ?? undefined,
    line: statement.source_line,
    source,
    propositions: statement.propositions.map((proposition) => ({
      path: proposition.path,
      value: proposition.has_value ? proposition.value : undefined,
      raw: rawProposition(
        proposition.path,
        proposition.has_value ? proposition.value : undefined
      )
    }))
  }));

  const unresolved: UnresolvedReference[] = draft.unresolved.map((ref) => ({
    id: ref.id,
    text: ref.text,
    candidates: ref.candidates,
    destructive: ref.destructive,
    reason: ref.reason ?? undefined,
    source,
    line: ref.source_line
  }));

  return {
    program: {
      version: INTENT_VERSION,
      statements,
      semantics: {
        ontology: CORE_ONTOLOGY,
        entities,
        operations
      },

      unresolved: unresolved.length ? unresolved : undefined,
      metadata: { name: source, source }
    },
    notes: [...draft.notes]
  };
}
