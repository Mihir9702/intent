#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseIntent, IntentParseError } from "./parser.js";
import { validateIntent } from "./validator.js";
import { applyInheritedPolicies } from "./project.js";
import { renderEnglish } from "./renderers/english.js";
import { renderClaude } from "./renderers/claude.js";
import { renderCompact } from "./renderers/compact.js";

async function load(file: string) {
  const source = await readFile(file, "utf8");
  return parseIntent(source, file);
}

function valuesAfterAll(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
}

function valueAfter(args: string[], flag: string): string | undefined {
  return valuesAfterAll(args, flag)[0];
}

async function loadWithPolicies(file: string, args: string[]) {
  const task = await load(file);
  const inheritedFiles = valuesAfterAll(args, "--inherit");
  if (!inheritedFiles.length) return task;
  const inherited = await Promise.all(inheritedFiles.map(load));
  return applyInheritedPolicies(task, inherited);
}

function printDiagnostics(result: ReturnType<typeof validateIntent>) {
  if (!result.diagnostics.length) console.log("PASS — no diagnostics");
  for (const d of result.diagnostics) {
    const location = d.source
      ? ` ${d.source}${d.line ? `:${d.line}` : ""}`
      : d.line ? ` line ${d.line}` : "";
    const related = d.relatedSource
      ? ` (related ${d.relatedSource}${d.relatedLine ? `:${d.relatedLine}` : ""})`
      : d.relatedLine ? ` (related line ${d.relatedLine})` : "";
    console.log(`${d.severity === "error" ? "ERROR" : "WARN"} ${d.code}${location}: ${d.message}${related}`);
  }
}

function usage(): never {
  console.log(`Intent 0.2

Usage:
  intent parse <file> [--inherit policy.intent]
  intent validate <file> [--inherit policy.intent]
  intent explain <file> [--inherit policy.intent]
  intent compile <file> [--inherit policy.intent] [--target claude|json|compact] [--out path]

--inherit may be repeated.`);
  process.exitCode = 2;
  throw new Error("usage");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("--help") || args.includes("-h")) usage();

  const [command, file] = args;
  const program = await loadWithPolicies(file, args);

  switch (command) {
    case "parse":
      console.log(JSON.stringify(program, null, 2));
      return;

    case "validate": {
      const result = validateIntent(program);
      printDiagnostics(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    case "explain":
      console.log(renderEnglish(program));
      return;

    case "compile": {
      const validation = validateIntent(program);
      if (!validation.ok) {
        printDiagnostics(validation);
        process.exitCode = 1;
        return;
      }

      const target = valueAfter(args, "--target") ?? "claude";
      const out = valueAfter(args, "--out");
      let output: string;

      if (target === "claude") output = renderClaude(program);
      else if (target === "json") output = JSON.stringify(program, null, 2);
      else if (target === "compact") output = renderCompact(program);
      else throw new Error(`unknown target '${target}'`);

      if (out) await writeFile(out, output + "\n", "utf8");
      else console.log(output);
      return;
    }

    default:
      usage();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.message === "usage") return;

  if (error instanceof IntentParseError) {
    console.log(`ERROR E000 line ${error.line}:${error.column}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
