import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { configInvalid, configNotFound } from "./errors.js";

export const RepriseConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    root: z.string().optional(),
    environment: z.string().default("development"),
  }),
  provider: z.object({
    name: z.string().min(1),
    options: z.record(z.unknown()).default({}),
  }),
  recovery: z
    .object({
      production_mutation: z.boolean().default(false),
      ephemeral_by_default: z.boolean().default(true),
      max_candidates: z.number().int().positive().default(5),
      production: z.object({
        require_verified: z.boolean().default(true),
        block_unknown: z.boolean().default(true),
        create_recovery_branch: z.boolean().default(true),
        require_checks: z.array(z.string()).default(["health", "schema"]),
        promotion: z.object({ automatic: z.boolean().default(false) }).default({}),
      }).default({}),
      preview: z.object({ automatic_recovery: z.boolean().default(false) }).default({}),
    })
    .default({}),
  verification: z
    .object({
      required_checks: z.array(z.string()).default(["health", "schema"]),
      timeout_ms: z.number().int().positive().default(60_000),
      fail_fast: z.boolean().default(true),
    })
    .default({}),
  policy: z
    .object({
      unknown_compatibility: z.enum(["block", "allow", "warn"]).default("block"),
      never_mutate_production: z.boolean().default(true),
      require_verified_before_promotion: z.boolean().default(true),
      block_unknown_compatibility: z.boolean().default(true),
      required_verification_checks: z.array(z.string()).default(["health", "schema"]),
      max_candidate_age: z.string().default("30d"),
      minimum_evidence_count: z.number().int().nonnegative().default(1),
    })
    .default({}),
  guards: z.object({
    destructive_schema: z.object({ block: z.boolean().default(true) }).default({}),
    maximum_checkpoint_age: z.string().default("24h"),
    minimum_evidence: z.object({ compatibility_checks: z.number().int().nonnegative().default(1) }).default({}),
  }).default({}),
  telemetry: z
    .object({
      enabled: z.boolean().default(true),
      redact_secrets: z.boolean().default(true),
      level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    })
    .default({}),
});

export type RepriseConfig = z.infer<typeof RepriseConfigSchema>;

/** Published JSON Schema mirror for tooling that validates reprise.yaml outside Node.js. */
export const RepriseConfigJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://reprise.dev/schemas/reprise.config.schema.json",
  title: "Reprise configuration",
  type: "object",
  required: ["project", "provider"],
  additionalProperties: false,
  properties: {
    project: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1 }, root: { type: "string" }, environment: { type: "string" } } },
    provider: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1 }, options: { type: "object", additionalProperties: true } } },
    recovery: { type: "object", additionalProperties: false },
    verification: { type: "object", additionalProperties: false },
    policy: { type: "object", additionalProperties: false },
    guards: { type: "object", additionalProperties: false },
    telemetry: { type: "object", additionalProperties: false },
  },
} as const;

/**
 * Validate a raw config object against the Reprise schema.
 */
export function validateConfig(raw: unknown): RepriseConfig {
  const result = RepriseConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw configInvalid(issues.join("; "), { issues: result.error.issues });
  }
  return result.data;
}

/**
 * Load and validate reprise.yaml from disk.
 */
export function loadConfig(path = "reprise.yaml"): RepriseConfig {
  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    throw configNotFound(absolute);
  }
  let raw: unknown;
  try {
    const text = readFileSync(absolute, "utf8");
    raw = parseYaml(text);
  } catch (err) {
    throw configInvalid(`failed to parse YAML at ${absolute}: ${(err as Error).message}`, {
      path: absolute,
    });
  }
  return validateConfig(raw);
}

/**
 * Parse a human duration like "30d", "12h", "45m", "90s" into milliseconds.
 */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    throw configInvalid(
      `invalid duration "${value}". Use forms like 30d, 12h, 45m, 90s, or 500ms.`,
      { value },
    );
  }
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? 1);
}
