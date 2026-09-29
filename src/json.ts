import type { IntentProgram } from "./model.js";
import { validateProgramShape } from "./schema.js";

export class IntentJsonError extends Error {
  constructor(
    message: string,
    public readonly code = "EJSON"
  ) {
    super(message);
    this.name = "IntentJsonError";
  }
}

/** Parse the canonical JSON representation and enforce structural validity. */
export function parseIntentJson(source: string): IntentProgram {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new IntentJsonError(
      `invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntentJsonError("canonical Intent JSON must be an object");
  }

  const program = value as IntentProgram;
  const errors = validateProgramShape(program).filter(
    (diagnostic) => diagnostic.severity === "error"
  );

  if (errors.length) {
    const first = errors[0];
    throw new IntentJsonError(`${first.code}: ${first.message}`, first.code);
  }

  return program;
}
