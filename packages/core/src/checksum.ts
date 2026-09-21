import { createHash } from "node:crypto";

/**
 * Compute a stable SHA-256 hex digest of the given input.
 */
export function sha256(input: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Deterministically serialize a value for checksumming.
 * Keys are sorted recursively so object key order does not affect hashes.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

/**
 * SHA-256 of the canonical JSON representation of a value.
 */
export function checksumOf(value: unknown): string {
  return sha256(canonicalize(value));
}

/**
 * Genesis / empty previous hash used at the start of a hash chain.
 */
export const GENESIS_HASH = sha256("reprise:genesis");
