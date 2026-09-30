import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SemanticFrontend, SemanticFrontendRequest, SemanticFrontendResult } from "../frontend.js";
import { SEMANTIC_DRAFT_SCHEMA, normalizeSemanticDraft } from "../semantic-draft.js";
import { buildSemanticParsingPrompt } from "./prompt.js";

export interface CodexSemanticFrontendOptions {
  command?: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
}

function runProcess(command: string, args: string[], stdin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Codex frontend exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(stdin);
  });
}

export class CodexSemanticFrontend implements SemanticFrontend {
  readonly name = "codex";
  private readonly command: string;
  private readonly commandPrefix: string[];
  private readonly model?: string;
  private readonly effort?: "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

  constructor(options: CodexSemanticFrontendOptions = {}) {
    if (options.command) {
      this.command = options.command;
      this.commandPrefix = [];
    } else if (process.platform === "win32") {
      const appData = process.env.APPDATA;
      const entry = appData
        ? join(appData, "npm", "node_modules", "@openai", "codex", "bin", "codex.js")
        : "";
      if (entry && existsSync(entry)) {
        this.command = process.execPath;
        this.commandPrefix = [entry];
      } else {
        this.command = "codex";
        this.commandPrefix = [];
      }
    } else {
      this.command = "codex";
      this.commandPrefix = [];
    }
    if (options.model && !/^[A-Za-z0-9._:-]+$/.test(options.model)) {
      throw new Error("Codex model name contains unsafe characters");
    }
    this.model = options.model;
    this.effort = options.effort;
  }

  async translate(request: SemanticFrontendRequest): Promise<SemanticFrontendResult> {
    const workdir = await mkdtemp(join(tmpdir(), "intent-codex-"));
    const schemaPath = join(workdir, "semantic-draft.schema.json");
    const outputPath = join(workdir, "result.json");

    try {
      await writeFile(schemaPath, JSON.stringify(SEMANTIC_DRAFT_SCHEMA, null, 2), "utf8");
      const args = [
        "exec",
        "--ephemeral",
        "--ignore-user-config",

        "--ignore-rules",
        "--skip-git-repo-check",
        "--sandbox", "read-only",
        "--color", "never",
        "-C", workdir,
        "--output-schema", schemaPath,
        "--output-last-message", outputPath
      ];
      if (this.model) args.push("--model", this.model);
      if (this.effort) args.push("-c", `model_reasoning_effort="${this.effort}"`);
      args.push("-");

      await runProcess(this.command, [...this.commandPrefix, ...args], buildSemanticParsingPrompt(request));
      const structured = JSON.parse(await readFile(outputPath, "utf8"));
      return normalizeSemanticDraft(
        structured,
        request.text,
        request.source ?? "semantic-input"
      );
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }
}
