import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { IntentProgram } from "./model.js";
import { verifyEvidence, type EvidenceBundle, type VerificationReport } from "./verifier.js";

export interface SupervisedExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  evidence: EvidenceBundle;
  verification: VerificationReport;
}

export interface SupervisorOptions {
  cwd?: string;
  watchDir?: string;
  env?: NodeJS.ProcessEnv;
}

async function scanFiles(dir: string, baseDir: string = dir): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await scanFiles(fullPath, baseDir);
        for (const [k, v] of sub) result.set(k, v);
      } else if (entry.isFile()) {
        try {
          const st = await stat(fullPath);
          result.set(relative(baseDir, fullPath).replace(/\\/g, "/"), st.mtimeMs);
        } catch {
          // ignore transient file read error
        }
      }
    }
  } catch {
    // directory may not exist
  }
  return result;
}

export async function superviseProcess(
  program: IntentProgram,
  command: string,
  args: string[],
  options: SupervisorOptions = {}
): Promise<SupervisedExecutionResult> {
  const cwd = options.cwd ?? process.cwd();
  const watchDir = options.watchDir ?? cwd;

  // Snapshot filesystem before execution
  const beforeFiles = await scanFiles(watchDir);

  const fullCommandLine = [command, ...args].join(" ");
  let stdout = "";
  let stderr = "";

  let executable = command;
  if (process.platform === "win32" && !executable.endsWith(".cmd") && !executable.endsWith(".exe") && !executable.endsWith(".bat")) {
    if (["npm", "pnpm", "yarn", "claude", "intent"].includes(executable)) {
      executable = `${executable}.cmd`;
    }
  }

  const child = spawn(executable, args, {
    cwd,
    env: options.env ?? process.env,
    shell: false,
    windowsHide: true
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });

  // Snapshot filesystem after execution
  const afterFiles = await scanFiles(watchDir);

  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [file, mtime] of afterFiles) {
    if (!beforeFiles.has(file)) {
      created.push(file);
    } else if (beforeFiles.get(file) !== mtime) {
      modified.push(file);
    }
  }

  for (const [file] of beforeFiles) {
    if (!afterFiles.has(file)) {
      deleted.push(file);
    }
  }

  const evidence: EvidenceBundle = {
    version: "0.1",
    timestamp: new Date().toISOString(),
    source: `supervisor: ${fullCommandLine}`,
    files: {
      created,
      modified,
      deleted
    },
    commands: [
      {
        command: fullCommandLine,
        exitCode,
        stdout,
        stderr
      }
    ],
    facts: {}
  };

  const verification = verifyEvidence(program, evidence);

  return {
    command: fullCommandLine,
    exitCode,
    stdout,
    stderr,
    evidence,
    verification
  };
}
