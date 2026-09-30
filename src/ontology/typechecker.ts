import type {
  CanonicalArgument,
  CanonicalEntity,
  CanonicalSemantics,
  OntologyDiagnostic
} from "./model.js";
import { CORE_ONTOLOGY } from "./model.js";
import { OPERATION_SIGNATURES, type ArgumentSpec } from "./registry.js";

const ID = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const NAMESPACED_TYPE = /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)+$/;

function entityMap(entities: CanonicalEntity[]): Map<string, CanonicalEntity> {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

function argKind(argument: CanonicalArgument): "entity" | "scalar" {
  return "entity" in argument ? "entity" : "scalar";
}

function scalarMatches(value: unknown, spec: ArgumentSpec): boolean {
  if (spec.scalarType === undefined || spec.scalarType === "any") return true;
  return typeof value === spec.scalarType;
}

type Compatibility = "compatible" | "incompatible" | "unknown";

function isSubtype(derived: string, base: string): boolean {
  if (derived === base) return true;
  return derived.startsWith(base + ".");
}

function compatibility(target: CanonicalEntity, replacement: CanonicalEntity): Compatibility {
  if (target.kind === "unknown" || replacement.kind === "unknown") return "unknown";
  if (target.kind !== replacement.kind) return "incompatible";
  if (target.type && replacement.type) {
    if (target.type === replacement.type) return "compatible";
    if (isSubtype(replacement.type, target.type)) return "compatible";
    return "incompatible";
  }
  if (target.type || replacement.type) return "unknown";
  return "compatible";
}

function dependencyCycles(semantics: CanonicalSemantics): string[][] {
  const graph = new Map(semantics.operations.map((operation) => [operation.id, operation.dependsOn]));
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  function visit(id: string): void {
    if (active.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      const key = [...new Set(cycle)].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(id)) return;

    active.add(id);
    stack.push(id);
    for (const dependency of graph.get(id) ?? []) {
      if (graph.has(dependency)) visit(dependency);
    }
    stack.pop();
    active.delete(id);
    visited.add(id);
  }

  for (const id of graph.keys()) visit(id);
  return cycles;
}

function unresolvedDiagnostic(entity: CanonicalEntity, operationId: string): OntologyDiagnostic {
  return {
    severity: "error",
    code: "E403",
    message: `operation '${operationId}' references unresolved entity '${entity.id}'`,
    source: entity.source,
    line: entity.line
  };
}

export function typeCheckSemantics(semantics: CanonicalSemantics): OntologyDiagnostic[] {
  const diagnostics: OntologyDiagnostic[] = [];

  if (semantics.ontology !== CORE_ONTOLOGY) {
    diagnostics.push({
      severity: "error",
      code: "E400",
      message: `unsupported ontology '${String(semantics.ontology)}'`
    });
    return diagnostics;
  }

  const seenEntityIds = new Set<string>();

  for (const entity of semantics.entities) {
    if (!ID.test(entity.id)) {
      diagnostics.push({
        severity: "error",
        code: "E401",
        message: `invalid entity id '${entity.id}'`,
        source: entity.source,
        line: entity.line
      });
    }
    if (seenEntityIds.has(entity.id)) {
      diagnostics.push({
        severity: "error",
        code: "E402",
        message: `duplicate entity id '${entity.id}'`,
        source: entity.source,
        line: entity.line
      });
    }
    seenEntityIds.add(entity.id);

    if (entity.type && !NAMESPACED_TYPE.test(entity.type)) {
      diagnostics.push({
        severity: "error",
        code: "E427",
        message: `entity type '${entity.type}' must be namespaced (for example adiya.invoice)`,
        source: entity.source,
        line: entity.line
      });
    }

    if (entity.resolution === "unresolved" && (!entity.candidates || entity.candidates.length < 2)) {
      diagnostics.push({
        severity: "warning",
        code: "W401",
        message: `unresolved entity '${entity.id}' should list at least two candidate meanings`,
        source: entity.source,
        line: entity.line
      });
    }
  }

  const entities = entityMap(semantics.entities);
  const operationIds = new Set(semantics.operations.map((operation) => operation.id));
  const seenOperationIds = new Set<string>();

  for (const operation of semantics.operations) {
    if (!ID.test(operation.id)) {
      diagnostics.push({
        severity: "error",
        code: "E404",
        message: `invalid operation id '${operation.id}'`,
        source: operation.source,
        line: operation.line
      });
    }
    if (seenOperationIds.has(operation.id)) {
      diagnostics.push({
        severity: "error",
        code: "E405",
        message: `duplicate operation id '${operation.id}'`,
        source: operation.source,
        line: operation.line
      });
    }
    seenOperationIds.add(operation.id);

    for (const dependency of operation.dependsOn) {
      if (dependency === operation.id) {
        diagnostics.push({
          severity: "error",
          code: "E424",
          message: `operation '${operation.id}' cannot depend on itself`,
          source: operation.source,
          line: operation.line
        });
      } else if (!operationIds.has(dependency)) {
        diagnostics.push({
          severity: "error",
          code: "E425",
          message: `operation '${operation.id}' depends on unknown operation '${dependency}'`,
          source: operation.source,
          line: operation.line
        });
      }
    }

    const signature = OPERATION_SIGNATURES[operation.kind];
    if (!signature) {
      diagnostics.push({
        severity: "error",
        code: "E406",
        message: `unknown canonical operation '${String(operation.kind)}'`,
        source: operation.source,
        line: operation.line
      });
      continue;
    }

    if (signature.target === "required" && !operation.target) {
      diagnostics.push({
        severity: "error",
        code: "E407",
        message: `operation '${operation.id}' requires a target`,
        source: operation.source,
        line: operation.line
      });
    }

    let targetEntity: CanonicalEntity | undefined;
    if (operation.target) {
      targetEntity = entities.get(operation.target);
      if (!targetEntity) {
        diagnostics.push({
          severity: "error",
          code: "E408",
          message: `operation '${operation.id}' references unknown target '${operation.target}'`,
          source: operation.source,
          line: operation.line
        });
      } else if (targetEntity.resolution === "unresolved") {
        diagnostics.push(unresolvedDiagnostic(targetEntity, operation.id));
      }
    }

    const byRole = new Map<string, CanonicalArgument[]>();
    for (const argument of operation.arguments) {
      byRole.set(argument.role, [...(byRole.get(argument.role) ?? []), argument]);
    }

    for (const [role, args] of byRole) {
      const spec = signature.arguments.find((candidate) => candidate.role === role);
      if (!spec) {
        diagnostics.push({
          severity: "error",
          code: "E409",
          message: `operation '${operation.id}' does not accept argument role '${role}'`,
          source: operation.source,
          line: operation.line
        });
        continue;
      }
      if (!spec.repeatable && args.length > 1) {
        diagnostics.push({
          severity: "error",
          code: "E410",
          message: `operation '${operation.id}' accepts only one '${role}' argument`,
          source: operation.source,
          line: operation.line
        });
      }

      for (const argument of args) {
        if (argKind(argument) !== spec.type) {
          diagnostics.push({
            severity: "error",
            code: "E411",
            message: `argument '${role}' on operation '${operation.id}' must be ${spec.type}-typed`,
            source: operation.source,
            line: operation.line
          });
          continue;
        }

        if (typeof argument.entity === "string") {
          const referenced = entities.get(argument.entity);
          if (!referenced) {
            diagnostics.push({
              severity: "error",
              code: "E412",
              message: `operation '${operation.id}' references unknown entity '${argument.entity}'`,
              source: operation.source,
              line: operation.line
            });
          } else if (referenced.resolution === "unresolved") {
            diagnostics.push(unresolvedDiagnostic(referenced, operation.id));
          }
          if (
            referenced &&
            spec.entityKinds?.length &&
            !spec.entityKinds.includes(referenced.kind)
          ) {
            diagnostics.push({
              severity: "error",
              code: "E416",
              message: `argument '${role}' on operation '${operation.id}' cannot reference entity kind '${referenced.kind}'`,
              source: operation.source,
              line: operation.line
            });
          }
        } else if (!scalarMatches(argument.value, spec)) {
          diagnostics.push({
            severity: "error",
            code: "E413",
            message: `argument '${role}' on operation '${operation.id}' has the wrong scalar type`,
            source: operation.source,
            line: operation.line
          });
        }
      }
    }

    for (const spec of signature.arguments) {
      if (spec.required && !(byRole.get(spec.role)?.length)) {
        diagnostics.push({
          severity: "error",
          code: "E414",
          message: `operation '${operation.id}' requires argument '${spec.role}'`,
          source: operation.source,
          line: operation.line
        });
      }
    }

    if (
      targetEntity &&
      signature.targetKinds?.length &&
      !signature.targetKinds.includes(targetEntity.kind)
    ) {
      diagnostics.push({
        severity: "error",
        code: "E417",
        message: `operation '${operation.id}' cannot target entity kind '${targetEntity.kind}'`,
        source: operation.source,
        line: operation.line
      });
    }

    if (signature.sameTypeAsTarget && targetEntity) {
      const candidate = byRole
        .get(signature.sameTypeAsTarget)
        ?.find((argument) => typeof argument.entity === "string");

      if (candidate && typeof candidate.entity === "string") {
        const replacement = entities.get(candidate.entity);
        if (replacement) {
          const relation = compatibility(targetEntity, replacement);
          if (relation === "incompatible") {
            diagnostics.push({
              severity: "error",
              code: "E415",
              message: `operation '${operation.id}' cannot replace ${targetEntity.kind} '${targetEntity.id}' with ${replacement.kind} '${replacement.id}'`,
              source: operation.source,
              line: operation.line
            });
          } else if (relation === "unknown") {
            diagnostics.push({
              severity: "warning",
              code: "W402",
              message: `operation '${operation.id}' replacement compatibility cannot be proven from available entity types`,
              source: operation.source,
              line: operation.line
            });
          }
        }
      }
    }
  }

  for (const cycle of dependencyCycles(semantics)) {
    diagnostics.push({
      severity: "error",
      code: "E426",
      message: `operation dependency cycle: ${cycle.join(" -> ")}`
    });
  }

  return diagnostics;
}
