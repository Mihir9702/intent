#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseIntent, IntentParseError } from "./parser.js";
import { parseIntentJson } from "./json.js";
import { validateIntent } from "./validator.js";
import { applyInheritedPolicies } from "./project.js";
import { INTENT_VERSION, type IntentProgram } from "./model.js";
import { ClaudeSemanticFrontend } from "./frontends/claude.js";
import { CodexSemanticFrontend } from "./frontends/codex.js";
import { renderEnglish } from "./renderers/english.js";
import { renderClaude } from "./renderers/claude.js";
import { renderCodex } from "./renderers/codex.js";
import { renderCompact } from "./renderers/compact.js";

async function load(file: string) {
  const source = await readFile(file, "utf8");
  return file.toLowerCase().endsWith(".json")
    ? parseIntentJson(source)
    : parseIntent(source, file);
}

const FLAGS_WITH_VALUES = new Set([
  "--inherit",
  "--target",
  "--via",
  "--model",
  "--effort",
  "--format",
  "--out"
]);

function valuesAfterAll(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      const val = args[i + 1];
      if (!val || val.startsWith("-")) {
        throw new Error(`missing argument value for '${flag}'`);
      }
      values.push(val);
    }
  }
  return values;
}

function valueAfter(args: string[], flag: string): string | undefined {
  return valuesAfterAll(args, flag)[0];
}

async function loadPolicies(args: string[]) {
  return Promise.all(valuesAfterAll(args, "--inherit").map(load));
}

async function loadWithPolicies(file: string, args: string[]) {
  const task = await load(file);
  const inherited = await loadPolicies(args);
  return inherited.length ? applyInheritedPolicies(task, inherited) : task;
}

function policyContext(inherited: IntentProgram[]): IntentProgram | undefined {
  if (!inherited.length) return undefined;
  return applyInheritedPolicies(
    { version: INTENT_VERSION, statements: [], metadata: { name: "inherited-policy" } },
    inherited
  );
}

function printDiagnostics(result: ReturnType<typeof validateIntent>, stderr = false) {
  const write = stderr ? console.error : console.log;
  if (!result.diagnostics.length) write("PASS — no diagnostics");
  for (const d of result.diagnostics) {
    const location = d.source
      ? ` ${d.source}${d.line ? `:${d.line}` : ""}`
      : d.line ? ` line ${d.line}` : "";
    const related = d.relatedSource
      ? ` (related ${d.relatedSource}${d.relatedLine ? `:${d.relatedLine}` : ""})`
      : d.relatedLine ? ` (related line ${d.relatedLine})` : "";
    write(`${d.severity === "error" ? "ERROR" : "WARN"} ${d.code}${location}: ${d.message}${related}`);
  }
}

function usage(code = 0): never {
  console.log(`Intent 0.3

Usage:
  intent parse <file> [--inherit policy.intent]
  intent validate <file> [--inherit policy.intent]
  intent check <file> [--inherit policy.intent]
  intent explain <file> [--inherit policy.intent]
  intent compile <file> [--inherit policy.intent] [--target claude|codex|json|compact] [--out path]
  intent translate <english.txt> --via claude|codex [--model name] [--effort high]
                   [--inherit policy.intent] [--format json|explain] [--out path]

--inherit may be repeated.
translate never executes coding tools; it only proposes and validates Intent.`);
  process.exitCode = code;
  throw new Error("usage");
}

async function emit(output: string, out?: string) {
  if (out) await writeFile(out, output + "\n", "utf8");
  else console.log(output);
}

async function translate(file: string, args: string[]) {
  const via = valueAfter(args, "--via") ?? "claude";
  if (!["claude", "codex"].includes(via)) {
    throw new Error(`unsupported semantic frontend '${via}'`);
  }

  const format = valueAfter(args, "--format") ?? "json";
  if (!["json", "explain"].includes(format)) {
    throw new Error("semantic translation output must be canonical json or explain");
  }

  const text = await readFile(file, "utf8");
  const inherited = await loadPolicies(args);
  const model = valueAfter(args, "--model");
  const effort = (valueAfter(args, "--effort") ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
  const frontend = via === "claude"
    ? new ClaudeSemanticFrontend({ model: model ?? "opus", effort })
    : new CodexSemanticFrontend({ model, effort });

  const translated = await frontend.translate({
    text,
    source: file,
    inheritedProgram: policyContext(inherited)
  });
  const program = inherited.length
    ? applyInheritedPolicies(translated.program, inherited)
    : translated.program;
  const validation = validateIntent(program);

  const output = format === "json"
    ? JSON.stringify(program, null, 2)
    : renderEnglish(program);

  await emit(output, valueAfter(args, "--out"));

  for (const note of translated.notes ?? []) {
    console.error(`NOTE frontend: ${note}`);
  }
  if (validation.diagnostics.length) printDiagnostics(validation, true);
  if (!validation.ok) process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) usage(0);

  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (FLAGS_WITH_VALUES.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("-")) continue;
    positionals.push(arg);
  }

  if (positionals.length < 2) usage(2);

  const [command, file] = positionals;

  if (command === "translate") {
    await translate(file, args);
    return;
  }

  const program = await loadWithPolicies(file, args);

  switch (command) {
    case "parse":
      console.log(JSON.stringify(program, null, 2));
      return;
    case "check":
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
      let output: string;
      if (target === "claude") output = renderClaude(program);
      else if (target === "codex") output = renderCodex(program);
      else if (target === "json") output = JSON.stringify(program, null, 2);
      else if (target === "compact") output = renderCompact(program);
      else throw new Error(`unknown target '${target}'`);

      await emit(output, valueAfter(args, "--out"));
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
