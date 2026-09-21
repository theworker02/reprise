import { z } from "zod";
import {
  type RecoveryPlan,
  parseDurationMs,
  validationError,
} from "@reprise/core";

export const PolicyDocumentSchema = z.object({
  never_mutate_production: z.boolean().default(true),
  require_verified_before_promotion: z.boolean().default(true),
  block_unknown_compatibility: z.boolean().default(true),
  required_verification_checks: z.array(z.string()).default(["health", "schema"]),
  max_candidate_age: z.string().default("30d"),
  minimum_evidence_count: z.number().int().nonnegative().default(1),
});

export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

export type PolicyDecision = "allow" | "deny";

export interface PolicyEvaluation {
  readonly decision: PolicyDecision;
  readonly reasons: readonly string[];
  readonly policy: PolicyDocument;
}

export interface CandidateContext {
  readonly candidateId: string;
  readonly ageMs: number;
  readonly evidenceCount: number;
  readonly compatibilityStatus?: "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
  readonly verified?: boolean;
  readonly promotingToProduction?: boolean;
  readonly mutatesProduction?: boolean;
}

export function parsePolicy(raw: unknown): PolicyDocument {
  const result = PolicyDocumentSchema.safeParse(raw ?? {});
  if (!result.success) {
    throw validationError(`Invalid policy document: ${result.error.message}`);
  }
  return result.data;
}

export function defaultPolicy(): PolicyDocument {
  return parsePolicy({});
}

/**
 * Evaluate machine-readable policies against plans and candidates.
 */
export class PolicyEngine {
  constructor(private readonly policy: PolicyDocument = defaultPolicy()) {}

  get document(): PolicyDocument {
    return this.policy;
  }

  evaluatePlan(plan: RecoveryPlan): PolicyEvaluation {
    const reasons: string[] = [];

    if (this.policy.never_mutate_production && plan.productionMutation) {
      reasons.push("never_mutate_production: plan requests production mutation");
    }

    if (
      this.policy.block_unknown_compatibility &&
      plan.unresolvedUnknowns.some((u) => u.toLowerCase().includes("unknown"))
    ) {
      reasons.push("block_unknown_compatibility: plan has unresolved compatibility unknowns");
    }

    if (this.policy.minimum_evidence_count > 0) {
      if (plan.evidence.length < this.policy.minimum_evidence_count) {
        reasons.push(
          `minimum_evidence_count: need ${this.policy.minimum_evidence_count}, have ${plan.evidence.length}`,
        );
      }
    }

    const required = new Set(this.policy.required_verification_checks);
    const planned = new Set(plan.verificationRequirements.map((v) => v.check));
    for (const check of [...required].sort()) {
      if (!planned.has(check)) {
        reasons.push(`required_verification_checks: missing "${check}"`);
      }
    }

    if (this.policy.require_verified_before_promotion) {
      const promotes = plan.operations.some((o) => o.kind === "promote" || o.finalizeRestore);
      if (promotes && plan.confidence < 0.5) {
        reasons.push("require_verified_before_promotion: confidence too low for promotion/finalize");
      }
    }

    return {
      decision: reasons.length === 0 ? "allow" : "deny",
      reasons,
      policy: this.policy,
    };
  }

  evaluateCandidate(candidate: CandidateContext): PolicyEvaluation {
    const reasons: string[] = [];
    const maxAge = parseDurationMs(this.policy.max_candidate_age);
    if (candidate.ageMs > maxAge) {
      reasons.push(
        `max_candidate_age: candidate ${candidate.candidateId} age ${candidate.ageMs}ms exceeds ${this.policy.max_candidate_age}`,
      );
    }
    if (candidate.evidenceCount < this.policy.minimum_evidence_count) {
      reasons.push(
        `minimum_evidence_count: candidate ${candidate.candidateId} has ${candidate.evidenceCount} evidence items`,
      );
    }
    if (
      this.policy.block_unknown_compatibility &&
      candidate.compatibilityStatus === "UNKNOWN"
    ) {
      reasons.push(`block_unknown_compatibility: candidate ${candidate.candidateId} is UNKNOWN`);
    }
    if (candidate.compatibilityStatus === "INCOMPATIBLE") {
      reasons.push(`candidate ${candidate.candidateId} is INCOMPATIBLE`);
    }
    if (this.policy.never_mutate_production && candidate.mutatesProduction) {
      reasons.push("never_mutate_production: candidate would mutate production");
    }
    if (
      this.policy.require_verified_before_promotion &&
      candidate.promotingToProduction &&
      !candidate.verified
    ) {
      reasons.push("require_verified_before_promotion: candidate not verified");
    }

    return {
      decision: reasons.length === 0 ? "allow" : "deny",
      reasons,
      policy: this.policy,
    };
  }
}
