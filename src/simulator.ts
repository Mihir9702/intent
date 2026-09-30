import type { IntentProgram, Proposition, Scalar } from "./model.js";
import type { CanonicalEntity, CanonicalOperation, CanonicalSemantics } from "./ontology/model.js";

export type EntityLifecycle = "unborn" | "active" | "modified" | "consumed" | "deleted";

export interface SimulationHazard {
  severity: "error" | "warning";
  code: "E501" | "E502" | "E503" | "E504";
  message: string;
  operationId: string;
  entityId: string;
  step: number;
}

export interface StateTransition {
  step: number;
  operationId: string;
  operationKind: string;
  target?: string;
  entityStatesBefore: Record<string, EntityLifecycle>;
  entityStatesAfter: Record<string, EntityLifecycle>;
  hazards: SimulationHazard[];
}

export interface SimulationResult {
  ok: boolean;
  totalSteps: number;
  transitions: StateTransition[];
  hazards: SimulationHazard[];
  finalEntityStates: Record<string, EntityLifecycle>;
}

function topologicalSort(operations: CanonicalOperation[]): CanonicalOperation[] {
  const byId = new Map(operations.map((o) => [o.id, o]));
  const visited = new Set<string>();
  const order: CanonicalOperation[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const op = byId.get(id);
    if (!op) return;
    for (const dep of op.dependsOn) {
      visit(dep);
    }
    order.push(op);
  }

  for (const op of operations) {
    visit(op.id);
  }

  return order;
}

export function simulateSemantics(program: IntentProgram): SimulationResult {
  const semantics = program.semantics;
  if (!semantics || !semantics.operations.length) {
    return {
      ok: true,
      totalSteps: 0,
      transitions: [],
      hazards: [],
      finalEntityStates: {}
    };
  }

  const entities = new Map<string, CanonicalEntity>(semantics.entities.map((e) => [e.id, e]));
  const operations = semantics.operations;

  // Identify entities that are created by an explicit 'create' operation
  const createdEntityIds = new Set<string>();
  for (const op of operations) {
    if (op.kind === "create" && op.target) {
      createdEntityIds.add(op.target);
    }
  }

  // Initial lifecycle states
  const entityStates: Record<string, EntityLifecycle> = {};
  for (const e of semantics.entities) {
    entityStates[e.id] = createdEntityIds.has(e.id) ? "unborn" : "active";
  }

  const sortedOps = topologicalSort(operations);
  const transitions: StateTransition[] = [];
  const hazards: SimulationHazard[] = [];

  let step = 1;

  for (const op of sortedOps) {
    const statesBefore = { ...entityStates };
    const stepHazards: SimulationHazard[] = [];

    // Target checks
    if (op.target) {
      const targetState = entityStates[op.target];
      if (op.kind === "create") {
        if (targetState === "active" || targetState === "modified") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E504",
            message: `operation '${op.id}' attempts to create already existing entity '@${op.target}'`,
            operationId: op.id,
            entityId: op.target,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        } else {
          entityStates[op.target] = "active";
        }
      } else {
        // Any non-create operation on target
        if (targetState === "deleted") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E501",
            message: `operation '${op.id}' (${op.kind}) attempts to access deleted entity '@${op.target}' (use-after-delete)`,
            operationId: op.id,
            entityId: op.target,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        } else if (targetState === "consumed") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E501",
            message: `operation '${op.id}' (${op.kind}) attempts to access consumed entity '@${op.target}' (use-after-consumption)`,
            operationId: op.id,
            entityId: op.target,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        } else if (targetState === "unborn") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E502",
            message: `operation '${op.id}' (${op.kind}) accesses entity '@${op.target}' before its creation (use-before-create)`,
            operationId: op.id,
            entityId: op.target,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        } else if (op.kind === "delete") {
          entityStates[op.target] = "deleted";
        } else if (op.kind === "replace") {
          entityStates[op.target] = "consumed";
        } else if (op.kind === "update" || op.kind === "set") {
          entityStates[op.target] = "modified";
        }
      }
    }

    // Argument checks
    for (const arg of op.arguments) {
      if ("entity" in arg && typeof arg.entity === "string") {
        const argState = entityStates[arg.entity];
        if (argState === "deleted") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E501",
            message: `argument '${arg.role}' in operation '${op.id}' references deleted entity '@${arg.entity}'`,
            operationId: op.id,
            entityId: arg.entity,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        } else if (argState === "consumed") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E501",
            message: `argument '${arg.role}' in operation '${op.id}' references consumed entity '@${arg.entity}'`,
            operationId: op.id,
            entityId: arg.entity,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        } else if (argState === "unborn") {
          const h: SimulationHazard = {
            severity: "error",
            code: "E502",
            message: `argument '${arg.role}' in operation '${op.id}' references unborn entity '@${arg.entity}' before creation`,
            operationId: op.id,
            entityId: arg.entity,
            step
          };
          stepHazards.push(h);
          hazards.push(h);
        }
      }
    }

    transitions.push({
      step,
      operationId: op.id,
      operationKind: op.kind,
      target: op.target,
      entityStatesBefore: statesBefore,
      entityStatesAfter: { ...entityStates },
      hazards: stepHazards
    });

    step++;
  }

  const ok = hazards.filter((h) => h.severity === "error").length === 0;

  return {
    ok,
    totalSteps: sortedOps.length,
    transitions,
    hazards,
    finalEntityStates: entityStates
  };
}

export function formatSimulationTrace(sim: SimulationResult): string {
  const lines: string[] = [
    "================================================================================",
    " INTENT OPERATIONAL STATE SIMULATION TRACE",
    ` Total Steps: ${sim.totalSteps} | State Status: ${sim.ok ? "SAFE (NO TEMPORAL HAZARDS)" : "HAZARDS DETECTED"}`,
    "================================================================================"
  ];

  for (const tr of sim.transitions) {
    const targetStr = tr.target ? ` on @${tr.target}` : "";
    lines.push(`Step ${tr.step}: [${tr.operationId}] ${tr.operationKind}${targetStr}`);
    if (tr.hazards.length) {
      for (const h of tr.hazards) {
        lines.push(`  ✖ HAZARD ${h.code}: ${h.message}`);
      }
    }
  }

  lines.push("\nFinal Entity Lifecycle States:");
  for (const [id, state] of Object.entries(sim.finalEntityStates)) {
    const icon = state === "deleted" ? "✖" : state === "consumed" ? "◇" : state === "modified" ? "✎" : "✔";
    lines.push(`  ${icon} @${id}: ${state}`);
  }

  if (sim.hazards.length) {
    lines.push("\nSimulation Diagnostics:");
    for (const h of sim.hazards) {
      lines.push(`  ${h.severity === "error" ? "ERROR" : "WARN"} ${h.code} (Step ${h.step}): ${h.message}`);
    }
  }

  lines.push("================================================================================");
  return lines.join("\n");
}
