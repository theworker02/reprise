import { describe, expect, it } from "vitest";
import type { RecoveryPlan } from "@reprise/core";
import { PolicyEngine, defaultPolicy, parsePolicy } from "./policy.js";

function samplePlan(overrides: Partial<RecoveryPlan> = {}): RecoveryPlan {
  return {
    id: "plan-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    suspectedChangeBoundary: [],
    candidateKnownGood: "snap-1",
    requiredComponents: ["snap-1"],
    operations: [
      {
        id: "restore_snapshot:snap-1",
        kind: "restore_snapshot",
        targetId: "snap-1",
        description: "restore",
        ephemeral: true,
        finalizeRestore: false,
        parameters: {},
        dependsOn: [],
      },
    ],
    verificationRequirements: [
      { check: "health", required: true },
      { check: "schema", required: true },
    ],
    confidence: 0.8,
    evidence: [{ kind: "verification", description: "ok" }],
    unresolvedUnknowns: [],
    productionMutation: false,
    ...overrides,
  };
}

describe("PolicyEngine", () => {
  it("defaults never_mutate_production to true and allows safe plans", () => {
    const policy = defaultPolicy();
    expect(policy.never_mutate_production).toBe(true);
    const engine = new PolicyEngine(policy);
    const result = engine.evaluatePlan(samplePlan());
    expect(result.decision).toBe("allow");
  });

  it("denies production mutation (negative)", () => {
    const engine = new PolicyEngine();
    const result = engine.evaluatePlan(samplePlan({ productionMutation: true }));
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("never_mutate_production"))).toBe(true);
  });

  it("denies unknown compatibility when blocked (negative)", () => {
    const engine = new PolicyEngine(parsePolicy({ block_unknown_compatibility: true }));
    const result = engine.evaluatePlan(
      samplePlan({ unresolvedUnknowns: ["Compatibility UNKNOWN between a and b"] }),
    );
    expect(result.decision).toBe("deny");
  });

  it("evaluates candidate age and evidence floors", () => {
    const engine = new PolicyEngine(
      parsePolicy({ max_candidate_age: "1d", minimum_evidence_count: 2 }),
    );
    const deny = engine.evaluateCandidate({
      candidateId: "c1",
      ageMs: 5 * 86_400_000,
      evidenceCount: 0,
      compatibilityStatus: "COMPATIBLE",
    });
    expect(deny.decision).toBe("deny");
    expect(deny.reasons.length).toBeGreaterThanOrEqual(2);

    const allow = engine.evaluateCandidate({
      candidateId: "c2",
      ageMs: 1000,
      evidenceCount: 2,
      compatibilityStatus: "COMPATIBLE",
      verified: true,
    });
    expect(allow.decision).toBe("allow");
  });
});
