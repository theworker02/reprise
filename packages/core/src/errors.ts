/**
 * Typed errors with actionable messages for Reprise operators.
 */

export type RepriseErrorCode =
  | "CONFIG_INVALID"
  | "CONFIG_NOT_FOUND"
  | "GRAPH_CORRUPT"
  | "GRAPH_NODE_NOT_FOUND"
  | "GRAPH_IMMUTABLE"
  | "LEDGER_CORRUPT"
  | "LEDGER_INTEGRITY_FAILED"
  | "COMPATIBILITY_UNKNOWN_BLOCKED"
  | "POLICY_DENIED"
  | "PROVIDER_UNSUPPORTED"
  | "PROVIDER_NOT_FOUND"
  | "VERIFICATION_FAILED"
  | "PLANNER_FAILED"
  | "VALIDATION_ERROR"
  | "IO_ERROR";

export class RepriseError extends Error {
  readonly code: RepriseErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: RepriseErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(`[${code}] ${message}`);
    this.name = "RepriseError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function configInvalid(message: string, details?: Record<string, unknown>): RepriseError {
  return new RepriseError(
    "CONFIG_INVALID",
    `Invalid reprise configuration: ${message}. Check reprise.yaml and fix the reported fields.`,
    details,
  );
}

export function configNotFound(path: string): RepriseError {
  return new RepriseError(
    "CONFIG_NOT_FOUND",
    `Configuration file not found at "${path}". Create a reprise.yaml in the project root.`,
    { path },
  );
}

export function graphNodeNotFound(nodeId: string): RepriseError {
  return new RepriseError(
    "GRAPH_NODE_NOT_FOUND",
    `State graph node "${nodeId}" was not found. Verify the node id or reload the graph from .reprise/graph/.`,
    { nodeId },
  );
}

export function graphImmutable(nodeId: string): RepriseError {
  return new RepriseError(
    "GRAPH_IMMUTABLE",
    `Cannot mutate historical node "${nodeId}". Append a new version instead of modifying past records.`,
    { nodeId },
  );
}

export function ledgerCorrupt(message: string, details?: Record<string, unknown>): RepriseError {
  return new RepriseError(
    "LEDGER_CORRUPT",
    `Change ledger is corrupted: ${message}. Do not append until integrity is restored.`,
    details,
  );
}

export function ledgerIntegrityFailed(index: number, expected: string, actual: string): RepriseError {
  return new RepriseError(
    "LEDGER_INTEGRITY_FAILED",
    `Ledger integrity check failed at entry index ${index}: expected hash ${expected}, got ${actual}. Refusing to accept corrupted chain.`,
    { index, expected, actual },
  );
}

export function policyDenied(reasons: readonly string[]): RepriseError {
  return new RepriseError(
    "POLICY_DENIED",
    `Policy evaluation denied the action: ${reasons.join("; ")}`,
    { reasons },
  );
}

export function providerNotFound(name: string): RepriseError {
  return new RepriseError(
    "PROVIDER_NOT_FOUND",
    `Provider "${name}" is not registered. Register it via the provider registry before use.`,
    { name },
  );
}

export function providerUnsupported(capability: string, provider: string): RepriseError {
  return new RepriseError(
    "PROVIDER_UNSUPPORTED",
    `Provider "${provider}" does not support capability "${capability}". Choose a provider that advertises this capability.`,
    { capability, provider },
  );
}

export function validationError(message: string, details?: Record<string, unknown>): RepriseError {
  return new RepriseError("VALIDATION_ERROR", message, details);
}
