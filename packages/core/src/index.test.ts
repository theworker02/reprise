import { describe, expect, it } from "vitest";
import { canonicalize, checksumOf, GENESIS_HASH, sha256 } from "./checksum.js";
import { loadConfig, parseDurationMs, validateConfig } from "./config.js";
import { RepriseError, configInvalid, ledgerIntegrityFailed } from "./errors.js";
import { REDACTED, isSecretKey, redact, redactString } from "./redaction.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("checksum", () => {
  it("produces stable sha256 digests", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
    expect(sha256("hello")).not.toBe(sha256("world"));
    expect(sha256("hello")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("canonicalizes objects regardless of key order", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(checksumOf({ b: 1, a: 2 })).toBe(checksumOf({ a: 2, b: 1 }));
  });

  it("exposes a fixed genesis hash", () => {
    expect(GENESIS_HASH).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("redaction", () => {
  it("detects secret keys", () => {
    expect(isSecretKey("api_key")).toBe(true);
    expect(isSecretKey("password")).toBe(true);
    expect(isSecretKey("connectionString")).toBe(true);
    expect(isSecretKey("label")).toBe(false);
  });

  it("redacts nested secrets", () => {
    const result = redact({
      label: "ok",
      apiKey: "sk_live_abcdefghijklmnop",
      nested: { password: "hunter2", count: 3 },
    }) as Record<string, unknown>;
    expect(result["label"]).toBe("ok");
    expect(result["apiKey"]).toBe(REDACTED);
    expect((result["nested"] as Record<string, unknown>)["password"]).toBe(REDACTED);
    expect((result["nested"] as Record<string, unknown>)["count"]).toBe(3);
  });

  it("redacts bearer tokens in strings", () => {
    expect(redactString("Authorization: Bearer abcdefghijklmnop")).toContain(REDACTED);
  });
});

describe("config", () => {
  it("validates a minimal config with defaults", () => {
    const cfg = validateConfig({
      project: { name: "demo" },
      provider: { name: "neon" },
    });
    expect(cfg.recovery.production_mutation).toBe(false);
    expect(cfg.policy.unknown_compatibility).toBe("block");
    expect(cfg.policy.never_mutate_production).toBe(true);
    expect(cfg.verification.required_checks).toEqual(["health", "schema"]);
  });

  it("rejects invalid config (negative path)", () => {
    expect(() => validateConfig({ project: {}, provider: { name: "x" } })).toThrow(RepriseError);
    try {
      validateConfig({});
    } catch (err) {
      expect(err).toBeInstanceOf(RepriseError);
      expect((err as RepriseError).code).toBe("CONFIG_INVALID");
    }
  });

  it("loads yaml from disk and fails when missing", () => {
    const dir = join(tmpdir(), `reprise-core-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "reprise.yaml");
    writeFileSync(
      path,
      `
project:
  name: demo
provider:
  name: neon
`,
    );
    const cfg = loadConfig(path);
    expect(cfg.project.name).toBe("demo");
    expect(() => loadConfig(join(dir, "missing.yaml"))).toThrow(RepriseError);
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses durations and rejects garbage", () => {
    expect(parseDurationMs("30d")).toBe(30 * 86_400_000);
    expect(parseDurationMs("12h")).toBe(12 * 3_600_000);
    expect(() => parseDurationMs("nope")).toThrow(RepriseError);
  });
});

describe("errors", () => {
  it("includes actionable messages", () => {
    const err = configInvalid("project.name is required");
    expect(err.message).toContain("CONFIG_INVALID");
    expect(err.message).toContain("reprise.yaml");
    const integrity = ledgerIntegrityFailed(2, "aaa", "bbb");
    expect(integrity.code).toBe("LEDGER_INTEGRITY_FAILED");
    expect(integrity.message).toContain("Refusing");
  });
});
