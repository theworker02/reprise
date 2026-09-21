import {
  type EvidenceItem,
  type Incident,
  type RecoveryOperation,
  type RecoveryPlan,
  type StateNode,
  type VerificationRequirement,
  checksumOf,
} from "@reprise/core";
import { CompatibilityEngine } from "@reprise/compatibility";
import type { StateGraph } from "@reprise/graph";
import type { ChangeLedger } from "@reprise/ledger";

export interface PlannerPolicy {
  readonly productionMutation?: boolean;
  readonly unknownCompatibility?: "block" | "allow" | "warn";
  readonly maxCandidates?: number;
  readonly requiredVerificationChecks?: readonly string[];
  readonly ephemeralByDefault?: boolean;
}

export interface PlannerInput {
  readonly currentState: StateGraph;
  readonly observedFailure: Incident;
  readonly policy?: PlannerPolicy;
  readonly historicalStates?: StateGraph;
  readonly ledger?: ChangeLedger;
  /** Fixed clock for determinism in tests. */
  readonly now?: string;
}

/**
 * Deterministic recovery planner: same inputs → same plan.
 */
export class RecoveryPlanner {
  private readonly compatibility: CompatibilityEngine;

  constructor(compatibility: CompatibilityEngine = new CompatibilityEngine()) {
    this.compatibility = compatibility;
  }

  plan(input: PlannerInput): RecoveryPlan {
    const now = input.now ?? "1970-01-01T00:00:00.000Z";
    const policy: Required<PlannerPolicy> = {
      productionMutation: input.policy?.productionMutation ?? false,
      unknownCompatibility: input.policy?.unknownCompatibility ?? "block",
      maxCandidates: input.policy?.maxCandidates ?? 5,
      requiredVerificationChecks: [
        ...(input.policy?.requiredVerificationChecks ?? ["health", "schema", "smoke"]),
      ].sort(),
      ephemeralByDefault: input.policy?.ephemeralByDefault ?? true,
    };

    const graph = input.historicalStates ?? input.currentState;
    const boundary = this.inferChangeBoundary(input);
    const candidates = graph
      .recoveryCandidates({
        asOf: now,
        limit: policy.maxCandidates,
      })
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.nodeId.localeCompare(b.nodeId);
      });

    const unresolvedUnknowns: string[] = [];
    const evidence: EvidenceItem[] = [];
    let chosen: string | null = null;
    let confidence = 0;

    for (const candidate of candidates) {
      const currentNodes = relatedCurrentNodes(input.currentState, input.observedFailure);
      let candidateOk = true;
      for (const current of currentNodes) {
        const result = this.compatibility.evaluate({
          from: current,
          to: candidate.nodeId,
          graph,
          signals: {
            priorVerification: candidate.verifiedAgainst.length > 0,
          },
        });
        evidence.push(...result.evidence);
        if (result.status === "INCOMPATIBLE") {
          candidateOk = false;
          break;
        }
        if (result.status === "UNKNOWN") {
          if (policy.unknownCompatibility === "block") {
            unresolvedUnknowns.push(
              `Compatibility UNKNOWN between ${current.id} and ${candidate.nodeId}`,
            );
            candidateOk = false;
            break;
          }
          unresolvedUnknowns.push(
            `Compatibility UNKNOWN (policy=${policy.unknownCompatibility}) for ${candidate.nodeId}`,
          );
        }
      }
      if (candidateOk) {
        chosen = candidate.nodeId;
        confidence = Math.max(0, Math.min(1, candidate.score / 20));
        evidence.push(...candidate.evidence);
        break;
      }
    }

    if (!chosen && candidates.length > 0 && policy.unknownCompatibility === "allow") {
      chosen = candidates[0]!.nodeId;
      confidence = 0.25;
      unresolvedUnknowns.push(`Selected ${chosen} under allow-unknown policy with low confidence`);
    }

    if (!chosen) {
      unresolvedUnknowns.push("No compatible known-good candidate identified");
      confidence = 0;
    }

    const requiredComponents = chosen
      ? [chosen, ...graph.dependencies(chosen)].sort()
      : [...input.observedFailure.relatedNodeIds].sort();

    const operations = this.buildOperations({
      chosen,
      boundary,
      policy,
      failure: input.observedFailure,
      graph,
    });

    const verificationRequirements: VerificationRequirement[] = policy.requiredVerificationChecks.map(
      (check) => ({
        check,
        required: true,
        description: `Required verification check: ${check}`,
      }),
    );

    const id = checksumOf({
      boundary,
      chosen,
      requiredComponents,
      operations: operations.map((o) => o.id),
      verificationRequirements,
      unresolvedUnknowns: unresolvedUnknowns.slice().sort(),
      failureId: input.observedFailure.id,
      policy,
    }).slice(0, 16);

    return {
      id: `plan-${id}`,
      createdAt: now,
      suspectedChangeBoundary: boundary,
      candidateKnownGood: chosen,
      requiredComponents,
      operations,
      verificationRequirements,
      confidence,
      evidence: dedupeEvidence(evidence),
      unresolvedUnknowns: unresolvedUnknowns.slice().sort(),
      productionMutation: policy.productionMutation,
    };
  }

  private inferChangeBoundary(input: PlannerInput): string[] {
    const related = [...input.observedFailure.relatedNodeIds].sort();
    const fromLedger: string[] = [];
    if (input.ledger) {
      const events = input.ledger.list();
      // Most recent events before/at incident time
      const incidentTs = Date.parse(input.observedFailure.observedAt);
      for (const event of [...events].reverse()) {
        if (Date.parse(event.timestamp) > incidentTs) continue;
        fromLedger.push(...event.targetIds);
        if (fromLedger.length >= 20) break;
      }
    }
    const radiusIds = related.flatMap((id) => {
      if (!input.currentState.hasNode(id)) return [];
      return input.currentState.blastRadius(id).impactedNodeIds;
    });
    return uniqueSorted([...related, ...fromLedger, ...radiusIds]);
  }

  private buildOperations(args: {
    chosen: string | null;
    boundary: readonly string[];
    policy: Required<PlannerPolicy>;
    failure: Incident;
    graph: StateGraph;
  }): RecoveryOperation[] {
    const ops: RecoveryOperation[] = [];
    if (!args.chosen) {
      return ops;
    }
    const node = args.graph.getNode(args.chosen);
    const ephemeral = args.policy.ephemeralByDefault;
    const finalize = args.policy.productionMutation ? true : false;

    if (node.type === "DatabaseSnapshot" || node.type === "DatabaseBranch") {
      ops.push({
        id: opId("create_branch", args.chosen),
        kind: "create_branch",
        targetId: args.chosen,
        description: `Create ephemeral recovery branch from ${args.chosen}`,
        ephemeral,
        finalizeRestore: false,
        parameters: { source: args.chosen },
        dependsOn: [],
      });
      ops.push({
        id: opId("restore_snapshot", args.chosen),
        kind: "restore_snapshot",
        targetId: args.chosen,
        description: `Restore snapshot/branch ${args.chosen} (finalize_restore=${finalize})`,
        ephemeral,
        finalizeRestore: finalize,
        parameters: { finalize_restore: finalize },
        dependsOn: [opId("create_branch", args.chosen)],
      });
    } else if (node.type === "Deployment" || node.type === "Release") {
      ops.push({
        id: opId("rollback_deployment", args.chosen),
        kind: "rollback_deployment",
        targetId: args.chosen,
        description: `Rollback deployment/release to ${args.chosen}`,
        ephemeral,
        finalizeRestore: finalize,
        parameters: {},
        dependsOn: [],
      });
    } else if (node.type === "Migration") {
      ops.push({
        id: opId("rollback_migration", args.chosen),
        kind: "rollback_migration",
        targetId: args.chosen,
        description: `Roll back migrations to ${args.chosen}`,
        ephemeral,
        finalizeRestore: finalize,
        parameters: {},
        dependsOn: [],
      });
    } else if (node.type === "FunctionRevision") {
      ops.push({
        id: opId("restore_function", args.chosen),
        kind: "restore_function",
        targetId: args.chosen,
        description: `Restore function revision ${args.chosen}`,
        ephemeral,
        finalizeRestore: finalize,
        parameters: {},
        dependsOn: [],
      });
    } else {
      ops.push({
        id: opId("custom", args.chosen),
        kind: "custom",
        targetId: args.chosen,
        description: `Recover component ${args.chosen} (${node.type})`,
        ephemeral,
        finalizeRestore: finalize,
        parameters: { type: node.type },
        dependsOn: [],
      });
    }

    ops.push({
      id: opId("verify", args.chosen),
      kind: "verify",
      targetId: args.chosen,
      description: `Verify recovery of ${args.chosen}`,
      ephemeral: true,
      finalizeRestore: false,
      parameters: { checks: args.policy.requiredVerificationChecks },
      dependsOn: ops.map((o) => o.id),
    });

    return ops.sort((a, b) => a.id.localeCompare(b.id));
  }
}

function relatedCurrentNodes(graph: StateGraph, failure: Incident): StateNode[] {
  const ids = [...failure.relatedNodeIds].sort();
  const nodes: StateNode[] = [];
  for (const id of ids) {
    if (graph.hasNode(id)) nodes.push(graph.getNode(id));
  }
  if (nodes.length === 0 && graph.listNodes().length > 0) {
    // Fall back to a stable first node for evaluation context
    nodes.push(graph.listNodes()[0]!);
  }
  return nodes;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function opId(kind: string, target: string): string {
  return `${kind}:${target}`;
}

function dedupeEvidence(items: readonly EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  const out: EvidenceItem[] = [];
  for (const item of items) {
    const key = checksumOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.description.localeCompare(b.description));
}
