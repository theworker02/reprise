import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChangeLedger } from "@reprise/ledger";
import { PolicyEngine, parsePolicy } from "@reprise/policy";
import { CheckpointStore, FileCheckpointStore, RecoveryGuard, TimeMachine, buildRecoverabilitySignal, createRecoveryReceipt, verifyRecoveryReceipt } from "./index.js";

const good = {
  organizationId: "org-1", projectId: "app", environment: "production", provider: "neon", stateRevision: "rev-7", createdAt: "2026-01-01T10:00:00.000Z", components: [{ kind: "deployment", id: "v1.7" }, { kind: "function", id: "users@81e3" }], compatibility: "COMPATIBLE" as const,
};

describe("TimeMachine and RecoveryGuard", () => {
  it("reconstructs the latest compatible checkpoint and creates verifiable receipt", () => {
    const store = new CheckpointStore();
    const checkpoint = store.create(good);
    const ledger = new ChangeLedger();
    ledger.append({ id: "deploy-8", type: "deployment", timestamp: "2026-01-01T10:10:00.000Z", summary: "v1.8", targetIds: ["deploy-v18"] });
    const incident = { id: "inc-1", title: "users failing", description: "contract mismatch", severity: "high" as const, observedAt: "2026-01-01T10:12:00.000Z", relatedNodeIds: ["deploy-v18"], symptoms: ["5xx"], attributes: {} };
    const reconstructed = new TimeMachine().reconstruct({ incident, checkpoints: store.list(), ledger });
    expect(reconstructed.candidate?.checkpointId).toBe(checkpoint.id);
    const guard = new RecoveryGuard(new PolicyEngine(parsePolicy({ never_mutate_production: false, block_unknown_compatibility: true })));
    const decision = guard.evaluate({ candidate: reconstructed.candidate!, currentStateRevision: "rev-7", promote: false });
    expect(decision.decision).toBe("allow");
    const receipt = createRecoveryReceipt({ incidentId: incident.id, candidate: reconstructed.candidate!, createdAt: incident.observedAt, guard: decision });
    expect(verifyRecoveryReceipt(receipt)).toBe(true);
  });

  it("blocks stale promotion even when candidate compatibility is compatible", () => {
    const candidate = { id: "candidate-1", checkpointId: "ckpt-1", components: [], compatibility: "COMPATIBLE" as const, evidence: [{ kind: "test", description: "evidence" }], unknowns: [], stateRevision: "rev-7" };
    const guard = new RecoveryGuard(new PolicyEngine(parsePolicy({ never_mutate_production: false, require_verified_before_promotion: true })));
    const result = guard.evaluate({ candidate, currentStateRevision: "rev-8", promote: true });
    expect(result.decision).toBe("block");
    expect(result.reasons.join(" ")).toContain("stale_plan");
  });

  it("persists only integrity-valid checkpoints", () => {
    const dir = mkdtempSync(join(tmpdir(), "reprise-checkpoints-"));
    const files = new FileCheckpointStore({ rootDir: dir });
    const store = files.loadOrCreate();
    store.create(good);
    files.save();
    expect(new FileCheckpointStore({ rootDir: dir }).load().list()).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports recoverability dimensions without hiding a stale state", () => {
    const checkpoint = new CheckpointStore().create(good);
    const signal = buildRecoverabilitySignal({ checkpoint, currentStateRevision: "rev-8", generatedAt: "2026-01-01T12:00:00.000Z" });
    expect(signal.status).toBe("BLOCKED");
    expect(signal.dimensions.freshness).toBe("STALE");
    expect(signal.signature).toMatch(/^[a-f0-9]{64}$/);
  });
});
