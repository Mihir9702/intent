import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { superviseProcess } from "../dist/src/supervisor.js";

test("supervisor: executes process, collects stdout and exit code", async () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "verification",
        propositions: [{ path: "test.run", raw: "test.run" }],
        line: 1
      },
      {
        kind: "done",
        propositions: [{ path: "completed", raw: "completed" }],
        line: 2
      }
    ]
  };

  const result = await superviseProcess(program, process.execPath, ["-e", "console.log('hello from supervisor');"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /hello from supervisor/);
  assert.equal(result.evidence.commands?.length, 1);
  assert.equal(result.evidence.commands?.[0].exitCode, 0);
});

test("supervisor: detects file modifications during process execution", async () => {
  const program = {
    version: "0.3",
    statements: [
      {
        kind: "verification",
        propositions: [{ path: "v", raw: "v" }],
        line: 1
      },
      {
        kind: "done",
        propositions: [{ path: "d", raw: "d" }],
        line: 2
      }
    ]
  };

  const scratchFile = join(process.cwd(), "test-scratch.tmp");
  try {
    const result = await superviseProcess(program, process.execPath, [
      "-e",
      `require('fs').writeFileSync('${scratchFile.replace(/\\/g, "\\\\")}', 'data');`
    ]);

    assert.equal(result.exitCode, 0);
    assert.equal(result.evidence.files?.created?.includes("test-scratch.tmp"), true);
  } finally {
    try {
      await unlink(scratchFile);
    } catch {
      // ignore
    }
  }
});
