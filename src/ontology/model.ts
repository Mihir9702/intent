import type { Scalar } from "../model.js";

export const CORE_ONTOLOGY = "intent-core/0.1" as const;

export type CoreEntityKind =
  | "document"
  | "record"
  | "collection"
  | "file"
  | "actor"
  | "system"
  | "service"
  | "resource"
  | "unknown";

export type EntityResolution = "resolved" | "unresolved";

export interface CanonicalEntity {
  id: string;
  kind: CoreEntityKind;
  /** Optional namespaced subtype, e.g. adiya.invoice or git.branch. */
  type?: string;
  label?: string;
  resolution: EntityResolution;
  candidates?: string[];
  source?: string;
  line?: number;
}

export type CanonicalOperationKind =
  | "observe"
  | "analyze"
  | "create"
  | "update"
  | "set"
  | "delete"
  | "replace"
  | "link"
  | "unlink"
  | "move"
  | "copy"
  | "execute";

export type CanonicalArgumentRole =
  | "with"
  | "to"
  | "from"
  | "related"
  | "field"
  | "value"
  | "input";

export type CanonicalArgument =
  | { role: CanonicalArgumentRole; entity: string; value?: never }
  | { role: CanonicalArgumentRole; value: Scalar; entity?: never };

export interface CanonicalOperation {
  id: string;
  kind: CanonicalOperationKind;
  target?: string;
  arguments: CanonicalArgument[];
  /** Operation ids that must complete before this operation. */
  dependsOn: string[];
  source?: string;
  line?: number;
}

export interface CanonicalSemantics {
  ontology: typeof CORE_ONTOLOGY;
  entities: CanonicalEntity[];
  operations: CanonicalOperation[];
}

export interface OntologyDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  source?: string;
  line?: number;
  relatedSource?: string;
  relatedLine?: number;
}
