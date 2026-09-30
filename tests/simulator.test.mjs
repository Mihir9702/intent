import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ONTOLOGY } from "../dist/src/ontology/model.js";
import { simulateSemantics, formatSimulationTrace } from "../dist/src/simulator.js";
import { validateIntent } from "../dist/src/validator.js";

test("simulator: cleanly simulates valid sequential entity lifecycle", () => {
  const program = {
    version: "0.3",
    statements: [
      { kind: "verification", propositions: [{ path: "v", raw: "v" }], line: 1 },
      { kind: "done", propositions: [{ path: "d", raw: "d" }], line: 2 }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "new_file", kind: "file", resolution: "resolved" }
      ],
      operations: [
        { id: "op_create", kind: "create", target: "new_file", arguments: [], dependsOn: [] },
        { id: "op_update", kind: "update", target: "new_file", arguments: [], dependsOn: ["op_create"] }
      ]
    }
  };

  const sim = simulateSemantics(program);
  assert.equal(sim.ok, true);
  assert.equal(sim.hazards.length, 0);
  assert.equal(sim.finalEntityStates.new_file, "modified");

  const trace = formatSimulationTrace(sim);
  assert.match(trace, /SAFE \(NO TEMPORAL HAZARDS\)/);
  assert.match(trace, /Step 1: \[op_create\] create on @new_file/);
  assert.match(trace, /Step 2: \[op_update\] update on @new_file/);
});

test("simulator: catches Use-After-Delete hazard (E501)", () => {
  const program = {
    version: "0.3",
    statements: [
      { kind: "verification", propositions: [{ path: "v", raw: "v" }], line: 1 },
      { kind: "done", propositions: [{ path: "d", raw: "d" }], line: 2 }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "temp_doc", kind: "document", resolution: "resolved" }
      ],
      operations: [
        { id: "op_del", kind: "delete", target: "temp_doc", arguments: [], dependsOn: [] },
        { id: "op_edit", kind: "update", target: "temp_doc", arguments: [], dependsOn: ["op_del"] }
      ]
    }
  };

  const sim = simulateSemantics(program);
  assert.equal(sim.ok, false);
  const hazard = sim.hazards.find((h) => h.code === "E501");
  assert.ok(hazard, "expected E501 use-after-delete");
  assert.match(hazard.message, /attempts to access deleted entity '@temp_doc'/);

  // Also verify that validateIntent catches this through the integrated pipeline
  const result = validateIntent(program);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((d) => d.code === "E501"), true);
});

test("simulator: catches Use-Before-Create hazard (E502)", () => {
  const program = {
    version: "0.3",
    statements: [
      { kind: "verification", propositions: [{ path: "v", raw: "v" }], line: 1 },
      { kind: "done", propositions: [{ path: "d", raw: "d" }], line: 2 }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "future_record", kind: "record", resolution: "resolved" }
      ],
      operations: [
        { id: "op_read", kind: "observe", target: "future_record", arguments: [], dependsOn: [] },
        { id: "op_create", kind: "create", target: "future_record", arguments: [], dependsOn: ["op_read"] }
      ]
    }
  };

  const sim = simulateSemantics(program);
  assert.equal(sim.ok, false);
  const hazard = sim.hazards.find((h) => h.code === "E502");
  assert.ok(hazard, "expected E502 use-before-create");
  assert.match(hazard.message, /before its creation/);
});

test("simulator: catches Double-Create hazard (E504)", () => {
  const program = {
    version: "0.3",
    statements: [
      { kind: "verification", propositions: [{ path: "v", raw: "v" }], line: 1 },
      { kind: "done", propositions: [{ path: "d", raw: "d" }], line: 2 }
    ],
    semantics: {
      ontology: CORE_ONTOLOGY,
      entities: [
        { id: "existing_service", kind: "service", resolution: "resolved" }
      ],
      operations: [
        { id: "op_create_again", kind: "create", target: "existing_service", arguments: [], dependsOn: [] }
      ]
    }
  };

  // 'existing_service' is active because it is not registered as being created in an unborn state
  // Wait, if op_create_again has target 'existing_service', createdEntityIds will have 'existing_service'.
  // But if there are TWO create operations for the same target:
  const doubleProgram = {
    ...program,
    semantics: {
      ...program.semantics,
      operations: [
        { id: "create_1", kind: "create", target: "existing_service", arguments: [], dependsOn: [] },
        { id: "create_2", kind: "create", target: "existing_service", arguments: [], dependsOn: ["create_1"] }
      ]
    }
  };

  const sim = simulateSemantics(doubleProgram);
  assert.equal(sim.ok, false);
  const hazard = sim.hazards.find((h) => h.code === "E504");
  assert.ok(hazard, "expected E504 double create");
});
