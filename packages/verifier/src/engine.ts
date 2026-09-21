import {
  type EvidenceItem,
  type RecoveryPlan,
  type VerificationCheckResult,
  type VerificationReceipt,
  type VerificationStatus,
  checksumOf,
} from "@reprise/core";

export type VerificationCheckName =
  | "health"
  | "migration"
  | "schema"
  | "smoke"
  | "api"
  | "dependency"
  | "data_integrity"
  | string;

export interface VerificationContext {
  readonly targetId: string;
  readonly plan?: RecoveryPlan;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly now?: string;
}

export interface VerificationPlugin {
  readonly name: string;
  run(ctx: VerificationContext): Promise<VerificationCheckResult> | VerificationCheckResult;
}

export interface VerifyOptions {
  readonly checks?: readonly VerificationCheckName[];
  readonly failFast?: boolean;
  readonly plugins?: readonly VerificationPlugin[];
}

function statusRank(status: VerificationStatus): number {
  switch (status) {
    case "failed":
      return 3;
    case "partial":
      return 2;
    case "skipped":
      return 1;
    case "verified":
      return 0;
  }
}

function aggregateStatus(checks: readonly VerificationCheckResult[]): VerificationStatus {
  if (checks.length === 0) return "skipped";
  let worst: VerificationStatus = "verified";
  for (const check of checks) {
    if (statusRank(check.status) > statusRank(worst)) worst = check.status;
  }
  if (worst === "verified" && checks.some((c) => c.status === "skipped")) {
    return "partial";
  }
  return worst;
}

const builtinPlugins: VerificationPlugin[] = [
  {
    name: "health",
    run(ctx) {
      const healthy = ctx.attributes?.["healthy"] !== false;
      return {
        name: "health",
        status: healthy ? "verified" : "failed",
        message: healthy ? "Health check passed" : "Health check failed",
        durationMs: 1,
        details: { targetId: ctx.targetId },
      };
    },
  },
  {
    name: "migration",
    run(ctx) {
      const pending = (ctx.attributes?.["pendingMigrations"] as string[] | undefined) ?? [];
      if (pending.length > 0) {
        return {
          name: "migration",
          status: "failed",
          message: `Pending migrations: ${pending.join(", ")}`,
          durationMs: 1,
          details: { pending },
        };
      }
      if (ctx.attributes?.["migrations"] === undefined) {
        return {
          name: "migration",
          status: "skipped",
          message: "No migration metadata available",
          durationMs: 0,
        };
      }
      return {
        name: "migration",
        status: "verified",
        message: "Migrations consistent",
        durationMs: 1,
      };
    },
  },
  {
    name: "schema",
    run(ctx) {
      const expected = ctx.attributes?.["expectedSchemaVersion"];
      const actual = ctx.attributes?.["schemaVersion"];
      if (expected === undefined || actual === undefined) {
        return {
          name: "schema",
          status: "skipped",
          message: "Schema versions not provided",
          durationMs: 0,
        };
      }
      const ok = expected === actual;
      return {
        name: "schema",
        status: ok ? "verified" : "failed",
        message: ok ? "Schema versions match" : `Schema mismatch expected=${expected} actual=${actual}`,
        durationMs: 1,
        details: { expected, actual },
      };
    },
  },
  {
    name: "smoke",
    run(ctx) {
      const smoke = ctx.attributes?.["smokePassed"];
      if (smoke === undefined) {
        return { name: "smoke", status: "skipped", message: "Smoke result not provided", durationMs: 0 };
      }
      return {
        name: "smoke",
        status: smoke ? "verified" : "failed",
        message: smoke ? "Smoke checks passed" : "Smoke checks failed",
        durationMs: 1,
      };
    },
  },
  {
    name: "api",
    run(ctx) {
      const api = ctx.attributes?.["apiHealthy"];
      if (api === undefined) {
        return { name: "api", status: "skipped", message: "API health not provided", durationMs: 0 };
      }
      return {
        name: "api",
        status: api ? "verified" : "failed",
        message: api ? "API checks passed" : "API checks failed",
        durationMs: 1,
      };
    },
  },
  {
    name: "dependency",
    run(ctx) {
      const deps = ctx.attributes?.["dependencyOk"];
      if (deps === undefined) {
        return {
          name: "dependency",
          status: "skipped",
          message: "Dependency status not provided",
          durationMs: 0,
        };
      }
      return {
        name: "dependency",
        status: deps ? "verified" : "failed",
        message: deps ? "Dependencies satisfied" : "Dependency check failed",
        durationMs: 1,
      };
    },
  },
  {
    name: "data_integrity",
    run(ctx) {
      const ok = ctx.attributes?.["dataIntegrityOk"];
      if (ok === undefined) {
        return {
          name: "data_integrity",
          status: "skipped",
          message: "Data integrity result not provided",
          durationMs: 0,
        };
      }
      return {
        name: "data_integrity",
        status: ok ? "verified" : "failed",
        message: ok ? "Data integrity verified" : "Data integrity failed",
        durationMs: 1,
      };
    },
  },
];

/**
 * Verification engine producing machine-readable VerificationReceipt JSON.
 */
export class VerificationEngine {
  private readonly plugins = new Map<string, VerificationPlugin>();

  constructor() {
    for (const plugin of builtinPlugins) {
      this.plugins.set(plugin.name, plugin);
    }
  }

  registerPlugin(plugin: VerificationPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  listPlugins(): string[] {
    return [...this.plugins.keys()].sort();
  }

  async verify(ctx: VerificationContext, options: VerifyOptions = {}): Promise<VerificationReceipt> {
    const checkNames = [...(options.checks ?? ["health", "schema", "smoke"])].sort();
    const failFast = options.failFast ?? true;
    for (const plugin of options.plugins ?? []) {
      this.plugins.set(plugin.name, plugin);
    }

    const results: VerificationCheckResult[] = [];
    for (const name of checkNames) {
      const plugin = this.plugins.get(name);
      const started = Date.now();
      let result: VerificationCheckResult;
      if (!plugin) {
        result = {
          name,
          status: "skipped",
          message: `No plugin registered for check "${name}"`,
          durationMs: 0,
        };
      } else {
        try {
          result = await plugin.run(ctx);
          if (result.durationMs === undefined || result.durationMs < 0) {
            result = { ...result, durationMs: Math.max(0, Date.now() - started) };
          }
        } catch (err) {
          result = {
            name,
            status: "failed",
            message: `Check threw: ${(err as Error).message}`,
            durationMs: Math.max(0, Date.now() - started),
          };
        }
      }
      results.push(result);
      if (failFast && result.status === "failed") break;
    }

    const status = aggregateStatus(results);
    const evidence: EvidenceItem[] = results.map((r) => ({
      kind: "verification_check",
      description: `${r.name}:${r.status} — ${r.message}`,
      weight: r.status === "verified" ? 1 : r.status === "failed" ? 3 : 0,
      data: { status: r.status, durationMs: r.durationMs },
    }));

    const createdAt = ctx.now ?? new Date().toISOString();
    const body = {
      planId: ctx.plan?.id,
      targetId: ctx.targetId,
      status,
      createdAt,
      checks: results,
      evidence,
    };
    const id = `vrf-${checksumOf(body).slice(0, 16)}`;
    const checksum = checksumOf({ ...body, id });

    return {
      id,
      planId: ctx.plan?.id,
      targetId: ctx.targetId,
      status,
      createdAt,
      checks: results,
      evidence,
      checksum,
    };
  }

  receiptToJSON(receipt: VerificationReceipt): string {
    return `${JSON.stringify(receipt, null, 2)}\n`;
  }
}
