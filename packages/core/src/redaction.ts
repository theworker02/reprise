/**
 * Redaction utilities — never leak secrets into logs, telemetry, or receipts.
 */

const SECRET_KEY_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|authorization|auth|bearer|cookie|session|connection[_-]?string|database[_-]?url|dsn)/i;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\b(sk|pk|rk|ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
  /postgres(?:ql)?:\/\/[^\s"']+/gi,
  /mysql:\/\/[^\s"']+/gi,
  /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
];

export const REDACTED = "[REDACTED]";

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * Redact secret-looking values inside strings.
 */
export function redactString(input: string): string {
  let result = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

/**
 * Deep-redact an arbitrary value for safe logging / telemetry.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 20) {
    return "[MAX_DEPTH]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redact(child, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Produce a redacted shallow copy of a record for structured logs.
 */
export function redactRecord(
  record: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return redact(record) as Record<string, unknown>;
}
