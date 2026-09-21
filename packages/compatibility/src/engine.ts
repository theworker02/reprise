import {
  type CompatibilityResult,
  type CompatibilityStatus,
  type EvidenceItem,
  type StateNode,
} from "@reprise/core";
import type { StateGraph } from "@reprise/graph";

export interface CompatibilitySignals {
  readonly schemaRequirements?: Readonly<Record<string, unknown>>;
  readonly migrationAncestry?: readonly string[];
  readonly apiContracts?: Readonly<Record<string, string>>;
  readonly dependencyVersions?: Readonly<Record<string, string>>;
  readonly configRequirements?: Readonly<Record<string, unknown>>;
  readonly storageContracts?: Readonly<Record<string, string>>;
  readonly policies?: readonly string[];
  readonly priorVerification?: boolean;
}

export interface EvaluateInput {
  readonly from: StateNode | string;
  readonly to: StateNode | string;
  readonly graph?: StateGraph;
  readonly signals?: CompatibilitySignals;
  /** When true, UNKNOWN must never be upgraded to COMPATIBLE (always enforced). */
  readonly strictUnknown?: boolean;
}

function asNode(ref: StateNode | string, graph?: StateGraph): StateNode {
  if (typeof ref !== "string") return ref;
  if (!graph) {
    return {
      id: ref,
      type: "Release",
      version: 1,
      label: ref,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      checksum: "",
      attributes: {},
      provenance: { source: "compatibility", observedAt: new Date(0).toISOString() },
      immutable: true,
    };
  }
  return graph.getNode(ref);
}

function compareMaps(
  required: Readonly<Record<string, unknown>> | undefined,
  actual: Readonly<Record<string, unknown>> | undefined,
  kind: string,
): { status: CompatibilityStatus; evidence: EvidenceItem[]; reasoning: string[] } {
  const evidence: EvidenceItem[] = [];
  const reasoning: string[] = [];
  if (!required || Object.keys(required).length === 0) {
    return { status: "UNKNOWN", evidence, reasoning: [`No ${kind} requirements provided`] };
  }
  if (!actual) {
    return {
      status: "UNKNOWN",
      evidence: [
        {
          kind,
          description: `Missing actual ${kind} data to compare against requirements`,
        },
      ],
      reasoning: [`Cannot evaluate ${kind}: actual values unknown`],
    };
  }
  let incompatible = false;
  let unknown = false;
  for (const key of Object.keys(required).sort()) {
    const want = required[key];
    if (!(key in actual)) {
      unknown = true;
      reasoning.push(`${kind}.${key} missing on candidate`);
      evidence.push({ kind, description: `Missing key ${key}`, weight: 1 });
      continue;
    }
    const got = actual[key];
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      incompatible = true;
      reasoning.push(`${kind}.${key} mismatch: required=${JSON.stringify(want)} actual=${JSON.stringify(got)}`);
      evidence.push({
        kind,
        description: `Mismatch on ${key}`,
        weight: 2,
        data: { required: want as unknown, actual: got as unknown },
      });
    } else {
      evidence.push({ kind, description: `Match on ${key}`, weight: 1 });
    }
  }
  if (incompatible) return { status: "INCOMPATIBLE", evidence, reasoning };
  if (unknown) return { status: "UNKNOWN", evidence, reasoning };
  return {
    status: "COMPATIBLE",
    evidence,
    reasoning: [`All ${kind} requirements satisfied`],
  };
}

/**
 * Merge signal statuses.
 * - Any INCOMPATIBLE wins.
 * - COMPATIBLE only when there is at least one positive COMPATIBLE signal
 *   and no INCOMPATIBLE (soft UNKNOWN from absent optional signals is ignored
 *   when positive evidence exists).
 * - Otherwise UNKNOWN. NEVER invent COMPATIBLE from pure UNKNOWN.
 */
function mergeStatus(
  parts: Array<{ status: CompatibilityStatus; evidence: EvidenceItem[] }>,
): CompatibilityStatus {
  if (parts.some((p) => p.status === "INCOMPATIBLE")) return "INCOMPATIBLE";
  const hasPositive = parts.some(
    (p) =>
      p.status === "COMPATIBLE" &&
      p.evidence.some((e) => (e.weight ?? 0) >= 1),
  );
  if (hasPositive) return "COMPATIBLE";
  if (parts.length === 0) return "UNKNOWN";
  return "UNKNOWN";
}

/**
 * Evidence-based compatibility engine.
 * NEVER converts UNKNOWN → COMPATIBLE.
 */
export class CompatibilityEngine {
  evaluate(input: EvaluateInput): CompatibilityResult {
    const from = asNode(input.from, input.graph);
    const to = asNode(input.to, input.graph);
    const signals = input.signals ?? deriveSignals(from, to, input.graph);
    const parts: Array<{ status: CompatibilityStatus; evidence: EvidenceItem[]; reasoning: string[] }> = [];

    parts.push(
      compareMaps(
        signals.schemaRequirements,
        (to.attributes["schema"] as Record<string, unknown> | undefined) ??
          (to.attributes["schemaRequirements"] as Record<string, unknown> | undefined),
        "schema",
      ),
    );

    if (signals.migrationAncestry && signals.migrationAncestry.length > 0) {
      const ancestry = new Set(
        (to.attributes["migrationAncestry"] as string[] | undefined) ??
          (input.graph ? collectMigrationAncestry(input.graph, to.id) : []),
      );
      const missing = signals.migrationAncestry.filter((m) => !ancestry.has(m));
      if (missing.length > 0) {
        parts.push({
          status: ancestry.size === 0 ? "UNKNOWN" : "INCOMPATIBLE",
          reasoning: [`Missing migration ancestry: ${missing.join(", ")}`],
          evidence: missing.map((m) => ({
            kind: "migration_ancestry",
            description: `Missing migration ${m}`,
            weight: 2,
          })),
        });
      } else {
        parts.push({
          status: "COMPATIBLE",
          reasoning: ["Migration ancestry satisfied"],
          evidence: [
            {
              kind: "migration_ancestry",
              description: "All required migrations present",
              weight: 1,
            },
          ],
        });
      }
    } else {
      parts.push({
        status: "UNKNOWN",
        reasoning: ["No migration ancestry signal provided"],
        evidence: [],
      });
    }

    parts.push(
      compareMaps(
        signals.apiContracts,
        (to.attributes["apiContracts"] as Record<string, unknown> | undefined) ?? undefined,
        "api_contracts",
      ),
    );
    parts.push(
      compareMaps(
        signals.dependencyVersions,
        (to.attributes["dependencyVersions"] as Record<string, unknown> | undefined) ?? undefined,
        "dependency_versions",
      ),
    );
    parts.push(
      compareMaps(
        signals.configRequirements,
        (to.attributes["config"] as Record<string, unknown> | undefined) ?? undefined,
        "config",
      ),
    );
    parts.push(
      compareMaps(
        signals.storageContracts,
        (to.attributes["storageContracts"] as Record<string, unknown> | undefined) ?? undefined,
        "storage_contracts",
      ),
    );

    if (signals.priorVerification === true) {
      parts.push({
        status: "COMPATIBLE",
        reasoning: ["Prior verification evidence present"],
        evidence: [
          {
            kind: "prior_verification",
            description: "Candidate previously verified",
            weight: 3,
          },
        ],
      });
    } else if (signals.priorVerification === false) {
      parts.push({
        status: "UNKNOWN",
        reasoning: ["No prior verification evidence"],
        evidence: [],
      });
    }

    if (input.graph) {
      const edge = input.graph
        .listEdges("COMPATIBLE_WITH")
        .find((e) => e.from === from.id && e.to === to.id);
      if (edge) {
        parts.push({
          status: "COMPATIBLE",
          reasoning: [`Graph asserts COMPATIBLE_WITH via ${edge.id}`],
          evidence: [
            {
              kind: "graph_edge",
              description: `COMPATIBLE_WITH ${edge.id}`,
              source: edge.id,
              weight: 2,
            },
          ],
        });
      }
      const verified = input.graph
        .listEdges("VERIFIED_AGAINST")
        .some((e) => e.to === to.id);
      if (verified) {
        parts.push({
          status: "COMPATIBLE",
          reasoning: ["Graph contains VERIFIED_AGAINST evidence for candidate"],
          evidence: [
            {
              kind: "prior_verification",
              description: "VERIFIED_AGAINST edge exists",
              weight: 3,
            },
          ],
        });
      }
    }

    // Policy signal: explicit deny policies force INCOMPATIBLE
    if (signals.policies?.includes("deny")) {
      parts.push({
        status: "INCOMPATIBLE",
        reasoning: ["Policy signal deny"],
        evidence: [{ kind: "policy", description: "deny policy", weight: 5 }],
      });
    }

    const status = mergeStatus(parts);
    // CRITICAL invariant: empty/unknown-only evidence must never become COMPATIBLE
    if (
      status === "COMPATIBLE" &&
      !parts.some((p) => p.status === "COMPATIBLE" && p.evidence.length > 0)
    ) {
      return {
        status: "UNKNOWN",
        reasoning: parts.flatMap((p) => p.reasoning),
        evidence: parts.flatMap((p) => p.evidence),
        fromId: from.id,
        toId: to.id,
      };
    }

    const reasoning = parts.flatMap((p) => p.reasoning);
    const evidence = parts.flatMap((p) => p.evidence).sort((a, b) => a.kind.localeCompare(b.kind));

    return {
      status,
      reasoning,
      evidence,
      fromId: from.id,
      toId: to.id,
    };
  }
}

function deriveSignals(from: StateNode, to: StateNode, graph?: StateGraph): CompatibilitySignals {
  const priorVerification = graph
    ? graph.listEdges("VERIFIED_AGAINST").some((e) => e.to === to.id)
    : undefined;
  return {
    schemaRequirements: (from.attributes["schemaRequirements"] as Record<string, unknown>) ?? undefined,
    migrationAncestry: (from.attributes["requiredMigrations"] as string[]) ?? undefined,
    apiContracts: (from.attributes["apiContracts"] as Record<string, string>) ?? undefined,
    dependencyVersions: (from.attributes["dependencyVersions"] as Record<string, string>) ?? undefined,
    configRequirements: (from.attributes["configRequirements"] as Record<string, unknown>) ?? undefined,
    storageContracts: (from.attributes["storageContracts"] as Record<string, string>) ?? undefined,
    priorVerification,
  };
}

function collectMigrationAncestry(graph: StateGraph, nodeId: string): string[] {
  const result = new Set<string>();
  const queue = [nodeId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = graph.hasNode(id) ? graph.getNode(id) : null;
    if (node?.type === "Migration") result.add(id);
    for (const edge of graph.listEdges()) {
      if (edge.from === id && (edge.type === "MIGRATED_FROM" || edge.type === "DEPENDS_ON")) {
        queue.push(edge.to);
      }
    }
  }
  return [...result].sort();
}

export const compatibilityEngine = new CompatibilityEngine();
