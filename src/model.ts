export const INTENT_VERSION = "0.2" as const;

export type StatementKind =
  | "goal"
  | "observation"
  | "hypothesis"
  | "constraint"
  | "invariant"
  | "risk"
  | "verification"
  | "done";

export type Scalar = string | number | boolean | null;

export interface Proposition {
  /** Canonical dotted path, e.g. financial_history.rewrite */
  path: string;
  /** Omitted for a bare proposition such as CPO.remove_line. */
  value?: Scalar;
  /** Original source text for faithful round-tripping and diagnostics. */
  raw: string;
}

export interface IntentStatement {
  kind: StatementKind;
  propositions: Proposition[];
  confidence?: number;
  line: number;
  /** Source file or frontend identifier for provenance-aware diagnostics. */
  source?: string;
}

export interface UnresolvedReference {
  id: string;
  text: string;
  candidates: string[];
  destructive?: boolean;
  reason?: string;
  source?: string;
  line?: number;
}

export interface IntentProgram {
  version: typeof INTENT_VERSION;
  statements: IntentStatement[];
  /** Ambiguities intentionally left unresolved by a semantic frontend. */
  unresolved?: UnresolvedReference[];
  metadata?: {
    name?: string;
    source?: string;
  };
}

export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  line?: number;
  source?: string;
  relatedLine?: number;
  relatedSource?: string;
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}
