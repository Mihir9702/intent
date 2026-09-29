import {
  INTENT_VERSION,
  type IntentProgram,
  type IntentStatement,
  type Scalar,
  type StatementKind,
  type UnresolvedReference
} from "./model.js";

export interface SemanticDraftProposition {
  path: string;
  has_value: boolean;
  value: Scalar;
}

export interface SemanticDraftStatement {
  kind: StatementKind;
  propositions: SemanticDraftProposition[];
  confidence: number | null;
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
  statements: SemanticDraftStatement[];
  unresolved: SemanticDraftUnresolved[];
  notes: string[];
}

export const SEMANTIC_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["statements", "unresolved", "notes"],
  properties: {
    statements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "propositions", "confidence", "source_line"],
        properties: {
          kind: {
            enum: ["goal", "observation", "hypothesis", "constraint", "invariant", "risk", "verification", "done"]
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
                value: {
                  anyOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "null" }
                  ]
                }
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

const KINDS = new Set<StatementKind>([
  "goal", "observation", "hypothesis", "constraint",
  "invariant", "risk", "verification", "done"
]);

const PATH = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function isScalar(value: unknown): value is Scalar {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function rawProposition(path: string, value: Scalar | undefined): string {
  if (value === undefined) return path;
  return `${path}=${typeof value === "string" ? JSON.stringify(value) : String(value)}`;
}

function assertDraft(draft: unknown, lineCount: number): asserts draft is SemanticDraft {
  if (!draft || typeof draft !== "object") throw new SemanticDraftError("semantic frontend returned a non-object");
  const value = draft as Record<string, unknown>;
  if (!Array.isArray(value.statements)) throw new SemanticDraftError("semantic draft statements must be an array");
  if (!Array.isArray(value.unresolved)) throw new SemanticDraftError("semantic draft unresolved must be an array");
  if (!Array.isArray(value.notes) || value.notes.some((note) => typeof note !== "string")) {
    throw new SemanticDraftError("semantic draft notes must be strings");
  }

  for (const statement of value.statements as Record<string, unknown>[]) {
    if (!KINDS.has(statement.kind as StatementKind)) throw new SemanticDraftError(`invalid statement kind '${String(statement.kind)}'`);
    if (!Number.isInteger(statement.source_line) || Number(statement.source_line) < 1 || Number(statement.source_line) > lineCount) {
      throw new SemanticDraftError(`source_line ${String(statement.source_line)} is outside the input text`);
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
    if (typeof ref.id !== "string" || !ref.id) throw new SemanticDraftError("unresolved reference requires id");
    if (typeof ref.text !== "string" || !ref.text) throw new SemanticDraftError(`unresolved '${String(ref.id)}' requires text`);
    if (!Array.isArray(ref.candidates) || ref.candidates.some((candidate) => typeof candidate !== "string")) {
      throw new SemanticDraftError(`unresolved '${ref.id}' has invalid candidates`);
    }
    if (typeof ref.destructive !== "boolean") throw new SemanticDraftError(`unresolved '${ref.id}' requires destructive boolean`);
    if (ref.reason !== null && typeof ref.reason !== "string") throw new SemanticDraftError(`unresolved '${ref.id}' has invalid reason`);
    if (!Number.isInteger(ref.source_line) || Number(ref.source_line) < 1 || Number(ref.source_line) > lineCount) {
      throw new SemanticDraftError(`unresolved '${ref.id}' has source_line outside the input text`);
    }
  }
}

export function normalizeSemanticDraft(draft: unknown, sourceText: string, source = "semantic-input"): {
  program: IntentProgram;
  notes: string[];
} {
  const lineCount = Math.max(1, sourceText.split(/\r?\n/).length);
  assertDraft(draft, lineCount);

  const statements: IntentStatement[] = draft.statements.map((statement) => ({
    kind: statement.kind,
    confidence: statement.confidence ?? undefined,
    line: statement.source_line,
    source,
    propositions: statement.propositions.map((proposition) => ({
      path: proposition.path,
      value: proposition.has_value ? proposition.value : undefined,
      raw: rawProposition(proposition.path, proposition.has_value ? proposition.value : undefined)
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
      unresolved: unresolved.length ? unresolved : undefined,
      metadata: { name: source, source }
    },
    notes: [...draft.notes]
  };
}
