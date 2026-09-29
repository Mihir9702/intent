import type { IntentProgram } from "./model.js";

export interface SemanticFrontendRequest {
  text: string;
  /** Human source name used for provenance, e.g. task.txt. */
  source?: string;
  /** Read-only policy/context. A frontend must not mutate or re-author it. */
  inheritedProgram?: IntentProgram;
}

export interface SemanticFrontendResult {
  /** Proposed AST. Ambiguity must be represented in program.unresolved. */
  program: IntentProgram;
  /** Non-semantic notes from the frontend, never treated as compiler truth. */
  notes?: string[];
}

/**
 * Probabilistic English → Intent translation lives behind this interface.
 * The compiler never trusts a frontend result until deterministic validation passes.
 */
export interface SemanticFrontend {
  readonly name: string;
  translate(request: SemanticFrontendRequest): Promise<SemanticFrontendResult>;
}
