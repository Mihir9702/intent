import { spawn } from "node:child_process";
import type { SemanticFrontend, SemanticFrontendRequest, SemanticFrontendResult } from "../frontend.js";
import {
  SEMANTIC_DRAFT_SCHEMA,
  normalizeSemanticDraft
} from "../semantic-draft.js";
import { buildSemanticParsingPrompt } from "./prompt.js";

export interface ClaudeSemanticFrontendOptions {
  command?: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

interface ProcessResult {
  stdout: string;
  stderr: string;
}

function runProcess(command: string, args: string[], stdin: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Claude frontend exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
    });

    child.stdin.end(stdin);
  });
}

function tryParseJson(value: unknown): unknown | undefined {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function extractClaudeStructuredOutput(stdout: string): unknown {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new Error("Claude frontend returned non-JSON output");
  }

  const record = envelope as Record<string, unknown>;
  const candidates = [
    record.structured_output,
    record.structuredOutput,
    record.output,
    record.result
  ];

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed !== undefined) return parsed;
  }

  if (record.statements && record.unresolved && record.notes) return record;
  throw new Error("Claude JSON response did not contain structured output");
}

export class ClaudeSemanticFrontend implements SemanticFrontend {
  readonly name = "claude";
  private readonly command: string;
  private readonly model: string;
  private readonly effort: "low" | "medium" | "high" | "xhigh" | "max";

  constructor(options: ClaudeSemanticFrontendOptions = {}) {
    this.command = options.command ?? "claude";
    this.model = options.model ?? "opus";
    this.effort = options.effort ?? "high";
  }

  async translate(request: SemanticFrontendRequest): Promise<SemanticFrontendResult> {
    const args = [
      "-p",
      "--safe-mode",
      "--no-session-persistence",
      "--permission-prompts", "none",
      "--tools", "",
      "--output-format", "json",
      "--json-schema", JSON.stringify(SEMANTIC_DRAFT_SCHEMA),
      "--model", this.model,
      "--effort", this.effort
    ];

    const prompt = buildSemanticParsingPrompt(request);
    const result = await runProcess(this.command, args, prompt);
    const structured = extractClaudeStructuredOutput(result.stdout);
    const normalized = normalizeSemanticDraft(
      structured,
      request.text,
      request.source ?? "semantic-input"
    );

    return normalized;
  }
}
