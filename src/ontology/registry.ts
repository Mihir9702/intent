import type {
  CanonicalArgumentRole,
  CanonicalOperationKind,
  CoreEntityKind
} from "./model.js";

export interface ArgumentSpec {
  role: CanonicalArgumentRole;
  type: "entity" | "scalar";
  required?: boolean;
  repeatable?: boolean;
  entityKinds?: readonly CoreEntityKind[];
  scalarType?: "string" | "number" | "boolean" | "any";
}

export interface OperationSignature {
  target: "required" | "optional" | "forbidden";
  targetKinds?: readonly CoreEntityKind[];
  arguments: readonly ArgumentSpec[];
  destructive?: boolean;
  /** Entity argument whose type must be assignable to the target. */
  sameTypeAsTarget?: CanonicalArgumentRole;
}

const NO_ARGS: readonly ArgumentSpec[] = [];

export const OPERATION_SIGNATURES: Record<CanonicalOperationKind, OperationSignature> = {
  observe: { target: "required", arguments: NO_ARGS },
  analyze: { target: "required", arguments: [{ role: "input", type: "entity", repeatable: true }] },
  create: { target: "required", arguments: [{ role: "input", type: "entity", repeatable: true }] },
  update: { target: "required", arguments: [{ role: "input", type: "entity", repeatable: true }] },
  set: {
    target: "required",
    arguments: [
      { role: "field", type: "scalar", scalarType: "string", required: true },
      { role: "value", type: "scalar", scalarType: "any", required: true }
    ]
  },
  delete: { target: "required", arguments: NO_ARGS, destructive: true },
  replace: {
    target: "required",
    arguments: [{ role: "with", type: "entity", required: true }],
    destructive: true,
    sameTypeAsTarget: "with"
  },
  link: {
    target: "required",
    arguments: [{ role: "related", type: "entity", required: true }]
  },
  unlink: {
    target: "required",
    arguments: [{ role: "related", type: "entity", required: true }],
    destructive: true
  },
  move: {
    target: "required",
    arguments: [{ role: "to", type: "entity", required: true }]
  },
  copy: {
    target: "required",
    arguments: [{ role: "to", type: "entity", required: true }]
  },
  execute: {
    target: "required",
    targetKinds: ["service", "system", "file", "resource"],
    arguments: [{ role: "input", type: "entity", repeatable: true }]
  }
};
