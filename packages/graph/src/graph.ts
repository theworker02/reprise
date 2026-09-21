import { createHash, randomUUID } from "node:crypto";
import {
  type BlastRadius,
  type EdgeType,
  type EvidenceItem,
  type NodeType,
  type Provenance,
  type StateEdge,
  type StateNode,
  checksumOf,
  graphImmutable,
  graphNodeNotFound,
  validationError,
} from "@reprise/core";

export interface AddNodeInput {
  readonly id?: string;
  readonly type: NodeType;
  readonly label: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly provenance: Provenance;
  readonly version?: number;
}

export interface AddEdgeInput {
  readonly id?: string;
  readonly type: EdgeType;
  readonly from: string;
  readonly to: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly provenance: Provenance;
}

export interface RecoveryCandidate {
  readonly nodeId: string;
  readonly label: string;
  readonly type: NodeType;
  readonly verifiedAgainst: readonly string[];
  readonly score: number;
  readonly evidence: readonly EvidenceItem[];
  readonly ageMs: number;
}

export interface StateGraphSnapshot {
  readonly version: number;
  readonly nodes: readonly StateNode[];
  readonly edges: readonly StateEdge[];
  readonly checksum: string;
}

function nodeChecksum(parts: {
  id: string;
  type: NodeType;
  version: number;
  label: string;
  attributes: Readonly<Record<string, unknown>>;
  provenance: Provenance;
}): string {
  return checksumOf(parts);
}

function edgeChecksum(parts: {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  attributes: Readonly<Record<string, unknown>>;
  provenance: Provenance;
}): string {
  return checksumOf(parts);
}

/**
 * Immutable historical state graph.
 * Past node/edge versions are never mutated — only appended / superseded.
 */
export class StateGraph {
  private readonly nodes = new Map<string, StateNode>();
  private readonly edges = new Map<string, StateEdge>();
  private graphVersion = 0;

  get size(): { nodes: number; edges: number } {
    return { nodes: this.nodes.size, edges: this.edges.size };
  }

  get version(): number {
    return this.graphVersion;
  }

  listNodes(type?: NodeType): StateNode[] {
    const all = [...this.nodes.values()];
    const filtered = type ? all.filter((n) => n.type === type) : all;
    return filtered.sort((a, b) => a.id.localeCompare(b.id));
  }

  listEdges(type?: EdgeType): StateEdge[] {
    const all = [...this.edges.values()];
    const filtered = type ? all.filter((e) => e.type === type) : all;
    return filtered.sort((a, b) => a.id.localeCompare(b.id));
  }

  getNode(id: string): StateNode {
    const node = this.nodes.get(id);
    if (!node) throw graphNodeNotFound(id);
    return node;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  getEdge(id: string): StateEdge | undefined {
    return this.edges.get(id);
  }

  /**
   * Append a new node. Historical records are always immutable.
   */
  addNode(input: AddNodeInput): StateNode {
    const id = input.id ?? `${input.type.toLowerCase()}-${stableId(input.label, input.provenance)}`;
    if (this.nodes.has(id)) {
      throw validationError(`Node "${id}" already exists. Use versionNode() to append a new version.`, {
        id,
      });
    }
    const now = input.provenance.observedAt;
    const attributes = Object.freeze({ ...(input.attributes ?? {}) });
    const node: StateNode = Object.freeze({
      id,
      type: input.type,
      version: input.version ?? 1,
      label: input.label,
      createdAt: now,
      updatedAt: now,
      attributes,
      provenance: Object.freeze({ ...input.provenance }),
      immutable: true,
      checksum: "",
    });
    const withChecksum: StateNode = Object.freeze({
      ...node,
      checksum: nodeChecksum({
        id: node.id,
        type: node.type,
        version: node.version,
        label: node.label,
        attributes: node.attributes,
        provenance: node.provenance,
      }),
    });
    this.nodes.set(id, withChecksum);
    this.graphVersion += 1;
    return withChecksum;
  }

  /**
   * Append a new version of an existing node; mark the prior as superseded.
   * Never mutates the historical record body beyond supersession pointer.
   */
  versionNode(
    existingId: string,
    updates: {
      readonly label?: string;
      readonly attributes?: Readonly<Record<string, unknown>>;
      readonly provenance: Provenance;
    },
  ): StateNode {
    const existing = this.getNode(existingId);
    if (!existing.immutable) {
      throw graphImmutable(existingId);
    }
    const newId = `${existingId}@v${existing.version + 1}`;
    // Record supersession via a frozen replacement — only supersededBy changes on the old node.
    const superseded: StateNode = Object.freeze({
      ...existing,
      supersededBy: newId,
    });
    this.nodes.set(existingId, superseded);

    return this.addNode({
      id: newId,
      type: existing.type,
      label: updates.label ?? existing.label,
      attributes: updates.attributes ?? existing.attributes,
      provenance: updates.provenance,
      version: existing.version + 1,
    });
  }

  addEdge(input: AddEdgeInput): StateEdge {
    if (!this.nodes.has(input.from)) throw graphNodeNotFound(input.from);
    if (!this.nodes.has(input.to)) throw graphNodeNotFound(input.to);
    const id =
      input.id ??
      `${input.type}:${input.from}->${input.to}:${stableId(input.type, input.provenance)}`;
    if (this.edges.has(id)) {
      throw validationError(`Edge "${id}" already exists.`, { id });
    }
    const attributes = Object.freeze({ ...(input.attributes ?? {}) });
    const base = {
      id,
      type: input.type,
      from: input.from,
      to: input.to,
      createdAt: input.provenance.observedAt,
      attributes,
      provenance: Object.freeze({ ...input.provenance }),
      immutable: true as const,
    };
    const edge: StateEdge = Object.freeze({
      ...base,
      checksum: edgeChecksum(base),
    });
    this.edges.set(id, edge);
    this.graphVersion += 1;
    return edge;
  }

  /**
   * Traverse DEPENDS_ON (and optionally other) outbound edges.
   */
  dependents(nodeId: string, edgeTypes: readonly EdgeType[] = ["DEPENDS_ON"]): string[] {
    this.getNode(nodeId);
    const allowed = new Set(edgeTypes);
    const result = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of this.edges.values()) {
        if (edge.to === current && allowed.has(edge.type) && !result.has(edge.from)) {
          result.add(edge.from);
          queue.push(edge.from);
        }
      }
    }
    return [...result].sort();
  }

  /**
   * Upstream dependencies of a node.
   */
  dependencies(nodeId: string, edgeTypes: readonly EdgeType[] = ["DEPENDS_ON"]): string[] {
    this.getNode(nodeId);
    const allowed = new Set(edgeTypes);
    const result = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of this.edges.values()) {
        if (edge.from === current && allowed.has(edge.type) && !result.has(edge.to)) {
          result.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    return [...result].sort();
  }

  /**
   * Blast-radius / impact analysis from an origin node.
   */
  blastRadius(originId: string, maxDepth = 32): BlastRadius {
    this.getNode(originId);
    const impacted = new Set<string>();
    const byType: Record<string, string[]> = {};
    let depthReached = 0;
    const queue: Array<{ id: string; depth: number }> = [{ id: originId, depth: 0 }];
    const visited = new Set<string>([originId]);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      depthReached = Math.max(depthReached, depth);
      if (depth >= maxDepth) continue;
      for (const edge of this.edges.values()) {
        // Impact flows to dependents (things that depend on us) and along SUPERSEDES.
        const next =
          edge.to === id && (edge.type === "DEPENDS_ON" || edge.type === "OBSERVED_WITH")
            ? edge.from
            : edge.from === id && edge.type === "SUPERSEDES"
              ? edge.to
              : null;
        if (next && !visited.has(next)) {
          visited.add(next);
          impacted.add(next);
          const node = this.nodes.get(next);
          if (node) {
            byType[node.type] ??= [];
            byType[node.type]!.push(next);
          }
          queue.push({ id: next, depth: depth + 1 });
        }
      }
    }

    for (const key of Object.keys(byType)) {
      byType[key] = byType[key]!.sort();
    }

    return {
      originId,
      impactedNodeIds: [...impacted].sort(),
      depth: depthReached,
      byType,
    };
  }

  /**
   * Nodes that have VERIFIED_AGAINST evidence pointing at them (known-good).
   */
  knownGoodStates(): StateNode[] {
    const verifiedTargets = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.type === "VERIFIED_AGAINST") {
        verifiedTargets.add(edge.to);
      }
    }
    return [...verifiedTargets]
      .map((id) => this.nodes.get(id))
      .filter((n): n is StateNode => n !== undefined && !n.supersededBy)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Generate recovery candidates from known-good / verified graph state.
   */
  recoveryCandidates(options?: {
    readonly asOf?: string;
    readonly types?: readonly NodeType[];
    readonly limit?: number;
  }): RecoveryCandidate[] {
    const asOf = options?.asOf ? Date.parse(options.asOf) : Date.now();
    const typeFilter = options?.types ? new Set(options.types) : null;
    const limit = options?.limit ?? 20;

    const verifiedEdges = this.listEdges("VERIFIED_AGAINST");
    const byTarget = new Map<string, StateEdge[]>();
    for (const edge of verifiedEdges) {
      const list = byTarget.get(edge.to) ?? [];
      list.push(edge);
      byTarget.set(edge.to, list);
    }

    const candidates: RecoveryCandidate[] = [];
    for (const [nodeId, edges] of byTarget) {
      const node = this.nodes.get(nodeId);
      if (!node || node.supersededBy) continue;
      if (typeFilter && !typeFilter.has(node.type)) continue;
      const ageMs = Math.max(0, asOf - Date.parse(node.createdAt));
      const evidence: EvidenceItem[] = edges
        .map((e) => ({
          kind: "verification",
          description: `Verified via edge ${e.id}`,
          source: e.from,
          weight: 1,
          data: { edgeType: e.type, createdAt: e.createdAt },
        }))
        .sort((a, b) => (a.source ?? "").localeCompare(b.source ?? ""));

      // Prefer more verification evidence and fresher states.
      const score = evidence.length * 10 - ageMs / 86_400_000;
      candidates.push({
        nodeId,
        label: node.label,
        type: node.type,
        verifiedAgainst: edges.map((e) => e.from).sort(),
        score,
        evidence,
        ageMs,
      });
    }

    return candidates
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.nodeId.localeCompare(b.nodeId);
      })
      .slice(0, limit);
  }

  toSnapshot(): StateGraphSnapshot {
    const nodes = this.listNodes();
    const edges = this.listEdges();
    const checksum = checksumOf({ nodes, edges, version: this.graphVersion });
    return { version: this.graphVersion, nodes, edges, checksum };
  }

  static fromSnapshot(snapshot: StateGraphSnapshot): StateGraph {
    const graph = new StateGraph();
    for (const node of snapshot.nodes) {
      graph.nodes.set(node.id, Object.freeze({ ...node, attributes: Object.freeze({ ...node.attributes }) }));
    }
    for (const edge of snapshot.edges) {
      graph.edges.set(edge.id, Object.freeze({ ...edge, attributes: Object.freeze({ ...edge.attributes }) }));
    }
    graph.graphVersion = snapshot.version;
    return graph;
  }

  /**
   * Deterministic JSON serialization (sorted keys via checksum helper path).
   */
  serialize(): string {
    const snapshot = this.toSnapshot();
    return `${JSON.stringify(
      {
        version: snapshot.version,
        checksum: snapshot.checksum,
        nodes: snapshot.nodes,
        edges: snapshot.edges,
      },
      null,
      2,
    )}\n`;
  }

  static deserialize(json: string): StateGraph {
    const parsed = JSON.parse(json) as StateGraphSnapshot;
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      throw validationError("Invalid state graph JSON: missing nodes/edges arrays.");
    }
    const graph = StateGraph.fromSnapshot(parsed);
    const actual = graph.toSnapshot().checksum;
    if (parsed.checksum && parsed.checksum !== actual) {
      throw validationError("State graph checksum mismatch — file may be corrupted.", {
        expected: parsed.checksum,
        actual,
      });
    }
    return graph;
  }
}

function stableId(label: string, provenance: Provenance): string {
  const seed = checksumOf({ label, source: provenance.source, observedAt: provenance.observedAt });
  return seed.slice(0, 12);
}

/** Helper for tests / callers that want a random id prefix. */
export function newGraphId(prefix: string): string {
  return `${prefix}-${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 10)}`;
}
