import { INTENT_VERSION, type IntentProgram, type IntentStatement, type Proposition, type Scalar, type StatementKind } from "./model.js";
import { validateProgramShape } from "./schema.js";

const KIND_MAP: Record<string, StatementKind> = {
  G: "goal",
  GOAL: "goal",
  OBS: "observation",
  H: "hypothesis",
  C: "constraint",
  INV: "invariant",
  RISK: "risk",
  V: "verification",
  VERIFY: "verification",
  DONE: "done"
};

export class IntentParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column = 1
  ) {
    super(message);
    this.name = "IntentParseError";
  }
}

function parseScalar(input: string): Scalar {
  const text = input.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "Ø") return null;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return Number(text);
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\([\\"'])/g, "$1");
  }
  return text;
}

function splitEntries(body: string): string[] {
  const entries: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    const prev = i > 0 ? body[i - 1] : "";
    if ((char === '"' || char === "'") && prev !== "\\") {
      quote = quote === char ? null : quote ?? char;
      current += char;
      continue;
    }
    if (!quote && (char === ";" || char === "\n" || char === ",")) {
      if (current.trim()) entries.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (quote) throw new Error("unterminated string literal");
  if (current.trim()) entries.push(current.trim());
  return entries;
}

function parseProposition(raw: string, line: number): Proposition {
  const eq = raw.indexOf("=");
  if (eq === -1) {
    const path = raw.trim();
    if (!path) throw new IntentParseError("empty proposition", line);
    return { path, raw: raw.trim() };
  }
  const path = raw.slice(0, eq).trim();
  const valueText = raw.slice(eq + 1).trim();
  if (!path) throw new IntentParseError("missing proposition path before '='", line);
  if (!valueText) throw new IntentParseError("missing proposition value after '='", line);
  return { path, value: parseScalar(valueText), raw: raw.trim() };
}

/** Parse the compact Intent DSL into its canonical AST. */
export function parseIntent(source: string, name?: string): IntentProgram {
  const statements: IntentStatement[] = [];
  let i = 0;

  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (i >= source.length) break;

    if (source[i] === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    const line = source.slice(0, i).split("\n").length;
    const kindMatch = source.slice(i).match(/^([A-Za-z]+)/);
    if (!kindMatch) throw new IntentParseError("expected statement kind", line);
    const token = kindMatch[1].toUpperCase();
    const kind = KIND_MAP[token];
    if (!kind) throw new IntentParseError(`unknown statement kind '${kindMatch[1]}'`, line);
    i += kindMatch[1].length;

    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== "{") throw new IntentParseError("expected '{' after statement kind", line);

    i++;
    const bodyStart = i;
    let depth = 1;
    let quote: string | null = null;
    while (i < source.length && depth > 0) {
      const char = source[i];
      const prev = i > 0 ? source[i - 1] : "";
      if ((char === '"' || char === "'") && prev !== "\\") {
        quote = quote === char ? null : quote ?? char;
      } else if (!quote) {
        if (char === "{") depth++;
        if (char === "}") depth--;
      }
      i++;
    }
    if (depth !== 0) throw new IntentParseError("unterminated '{' block", line);

    const body = source.slice(bodyStart, i - 1);
    let confidence: number | undefined;
    while (i < source.length && /[ \t]/.test(source[i])) i++;
    if (source[i] === "^") {
      i++;
      const numMatch = source.slice(i).match(/^[^\s,;}]+/);
      if (!numMatch || !/^(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/.test(numMatch[0])) {
        throw new IntentParseError("expected confidence between 0 and 1 after '^'", line);
      }
      confidence = Number(numMatch[0]);
      i += numMatch[0].length;
    }

    let entries: string[];
    try {
      entries = splitEntries(body);
    } catch (error) {
      throw new IntentParseError((error as Error).message, line);
    }
    if (entries.length === 0) throw new IntentParseError("statement block cannot be empty", line);

    const propositions = entries.map((entry) => parseProposition(entry, line));
    statements.push({ kind, propositions, confidence, line, source: name });
  }

  const program: IntentProgram = {
    version: INTENT_VERSION,
    statements,
    metadata: name ? { name, source: name } : undefined
  };

  const shapeErrors = validateProgramShape(program).filter((d) => d.severity === "error");
  if (shapeErrors.length) {
    const first = shapeErrors[0];
    throw new IntentParseError(first.message, first.line ?? 1);
  }
  return program;
}
