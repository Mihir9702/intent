import { readFile } from "node:fs/promises";
import { parseIntentJson } from "../dist/src/json.js";
import { parseIntent } from "../dist/src/parser.js";
import { validateIntent } from "../dist/src/validator.js";
import { applyInheritedPolicies } from "../dist/src/project.js";
import { renderClaude } from "../dist/src/renderers/claude.js";
import { renderCodex } from "../dist/src/renderers/codex.js";

async function load(file) {
  const source = await readFile(file, "utf8");
  return file.toLowerCase().endsWith(".json")
    ? parseIntentJson(source)
    : parseIntent(source, file);
}

async function run() {
  const content = await readFile(new URL("./scenarios.json", import.meta.url), "utf8");
  const scenarios = JSON.parse(content);

  console.log("================================================================================");
  console.log(" INTENT v0.3 BENCHMARK EVALUATION SUITE");
  console.log(" Deterministic AST, Canonical Ontology & Policy Verification");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  for (const s of scenarios) {
    let program = s.task;
    if (s.input) {
      program = await load(s.input);
    }

    if (s.inherit?.length) {
      const policies = await Promise.all(s.inherit.map(load));
      program = applyInheritedPolicies(program, policies);
    }

    const result = validateIntent(program);
    const codes = result.diagnostics.map((d) => d.code);

    let scenarioOk = result.ok === s.expectedOk;
    for (const exp of s.expectedDiagnostics) {
      if (!codes.includes(exp)) {
        scenarioOk = false;
      }
    }

    if (s.testCompilers?.includes("claude")) {
      try {
        const xml = renderClaude(program);
        if (!xml.includes("<intent version=\"0.3\">")) scenarioOk = false;
      } catch {
        scenarioOk = false;
      }
    }

    if (s.testCompilers?.includes("codex")) {
      try {
        const md = renderCodex(program);
        if (!md.includes("# Intent Execution Specification")) scenarioOk = false;
      } catch {
        scenarioOk = false;
      }
    }

    const status = scenarioOk ? "PASS" : "FAIL";
    if (scenarioOk) passed++;
    else failed++;

    console.log(`[${status}] ${s.id}: ${s.name}`);
    console.log(`       Outcome: ok=${result.ok} (expected: ${s.expectedOk})`);
    console.log(`       Diagnostics: [${codes.join(", ") || "none"}] (expected: [${s.expectedDiagnostics.join(", ") || "none"}])`);
  }

  console.log("\n================================================================================");
  console.log(` EVALUATION SUMMARY: ${passed} passed, ${failed} failed out of ${scenarios.length} scenarios`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Evaluation runner error:", err);
  process.exitCode = 1;
});
