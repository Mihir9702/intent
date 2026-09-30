import type {
  CanonicalSemantics,
  CoreEntityKind,
  EntityResolution,
  OntologyDiagnostic
} from "./model.js";

const ENTITY_KINDS = new Set<CoreEntityKind>([
  "document", "record", "collection", "file", "actor",
  "system", "service", "resource", "unknown"
]);

const RESOLUTIONS = new Set<EntityResolution>(["resolved", "unresolved"]);
const OPERATION_KINDS = new Set([
  "observe", "analyze", "create", "update", "set", "delete",
  "replace", "link", "unlink", "move", "copy", "execute"
]);
const ARGUMENT_ROLES = new Set([
  "with", "to", "from", "related", "field", "value", "input"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function scalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function validateSemanticsShape(value: unknown): OntologyDiagnostic[] {
  const diagnostics: OntologyDiagnostic[] = [];
  if (!isRecord(value)) {
    return [{ severity: "error", code: "E380", message: "semantics must be an object" }];
  }

  if (value.ontology !== "intent-core/0.1") {
    diagnostics.push({
      severity: "error",
      code: "E381",
      message: `unsupported or missing ontology '${String(value.ontology)}'`
    });
  }

  if (!Array.isArray(value.entities)) {
    diagnostics.push({ severity: "error", code: "E382", message: "semantics.entities must be an array" });
  } else {
    for (const entity of value.entities) validateEntity(entity, diagnostics);
  }

  if (!Array.isArray(value.operations)) {
    diagnostics.push({ severity: "error", code: "E383", message: "semantics.operations must be an array" });
  } else {
    for (const operation of value.operations) validateOperation(operation, diagnostics);
  }

  return diagnostics;
}

function validateEntity(value: unknown, diagnostics: OntologyDiagnostic[]): void {
  if (!isRecord(value)) {
    diagnostics.push({ severity: "error", code: "E384", message: "canonical entity must be an object" });
    return;
  }

  if (typeof value.id !== "string") {
    diagnostics.push({ severity: "error", code: "E385", message: "canonical entity requires string id" });
  }
  if (!ENTITY_KINDS.has(value.kind as CoreEntityKind)) {
    diagnostics.push({
      severity: "error",
      code: "E386",
      message: `invalid canonical entity kind '${String(value.kind)}'`
    });
  }
  if (!RESOLUTIONS.has(value.resolution as EntityResolution)) {
    diagnostics.push({
      severity: "error",
      code: "E387",
      message: `invalid entity resolution '${String(value.resolution)}'`
    });
  }

  if (value.type !== undefined && typeof value.type !== "string") {
    diagnostics.push({ severity: "error", code: "E388", message: "entity type must be a string" });
  }
  if (value.label !== undefined && typeof value.label !== "string") {
    diagnostics.push({ severity: "error", code: "E389", message: "entity label must be a string" });
  }
  if (
    value.candidates !== undefined &&
    (!Array.isArray(value.candidates) || value.candidates.some((candidate) => typeof candidate !== "string"))
  ) {
    diagnostics.push({ severity: "error", code: "E390", message: "entity candidates must be strings" });
  }
  if (value.source !== undefined && typeof value.source !== "string") {
    diagnostics.push({ severity: "error", code: "E391", message: "entity source must be a string" });
  }
  if (value.line !== undefined && (!Number.isInteger(value.line) || Number(value.line) < 1)) {
    diagnostics.push({ severity: "error", code: "E392", message: "entity line must be a positive integer" });
  }
}

function validateOperation(value: unknown, diagnostics: OntologyDiagnostic[]): void {
  if (!isRecord(value)) {
    diagnostics.push({ severity: "error", code: "E393", message: "canonical operation must be an object" });
    return;
  }

  if (typeof value.id !== "string") {
    diagnostics.push({ severity: "error", code: "E394", message: "canonical operation requires string id" });
  }
  if (!OPERATION_KINDS.has(String(value.kind))) {
    diagnostics.push({
      severity: "error",
      code: "E395",
      message: `invalid canonical operation kind '${String(value.kind)}'`
    });
  }
  if (value.target !== undefined && typeof value.target !== "string") {
    diagnostics.push({ severity: "error", code: "E396", message: "operation target must be an entity id" });
  }
  if (!Array.isArray(value.arguments)) {
    diagnostics.push({ severity: "error", code: "E397", message: "operation arguments must be an array" });
  } else {
    for (const argument of value.arguments) validateArgument(argument, diagnostics);
  }
  if (!Array.isArray(value.dependsOn) || value.dependsOn.some((dependency) => typeof dependency !== "string")) {
    diagnostics.push({ severity: "error", code: "E423", message: "operation dependsOn must be an array of operation ids" });
  }
  if (value.source !== undefined && typeof value.source !== "string") {
    diagnostics.push({ severity: "error", code: "E398", message: "operation source must be a string" });
  }
  if (value.line !== undefined && (!Number.isInteger(value.line) || Number(value.line) < 1)) {
    diagnostics.push({ severity: "error", code: "E399", message: "operation line must be a positive integer" });
  }
}

function validateArgument(value: unknown, diagnostics: OntologyDiagnostic[]): void {
  if (!isRecord(value)) {
    diagnostics.push({ severity: "error", code: "E418", message: "canonical argument must be an object" });
    return;
  }

  if (!ARGUMENT_ROLES.has(String(value.role))) {
    diagnostics.push({
      severity: "error",
      code: "E419",
      message: `invalid canonical argument role '${String(value.role)}'`
    });
  }

  const hasEntity = Object.prototype.hasOwnProperty.call(value, "entity") && (value as Record<string, unknown>).entity !== undefined;
  const hasValue = Object.prototype.hasOwnProperty.call(value, "value") && (value as Record<string, unknown>).value !== undefined;
  if (hasEntity === hasValue) {
    diagnostics.push({
      severity: "error",
      code: "E420",
      message: "canonical argument must contain exactly one of entity or value"
    });
    return;
  }

  if (hasEntity && typeof value.entity !== "string") {
    diagnostics.push({ severity: "error", code: "E421", message: "argument entity must be a string id" });
  }
  if (hasValue && !scalar(value.value)) {
    diagnostics.push({ severity: "error", code: "E422", message: "argument value must be scalar" });
  }
}

export function isCanonicalSemantics(value: unknown): value is CanonicalSemantics {
  return validateSemanticsShape(value).every((diagnostic) => diagnostic.severity !== "error");
}
