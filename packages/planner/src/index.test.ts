import { describe, expect, it } from "vitest";
import { StateGraph } from "@reprise/graph";
import { ChangeLedger } from "@reprise/ledger";
import { RecoveryPlanner } from "./planner.js";

function prov(at = "2026-01-01T00:00:00.000Z") {
  return { source: "test", observedAt: at };
}

function buildGraph() {
  const g = new StateGraph();
  g.addNode({
    id: "snap-good",
    type: "DatabaseSnapshot",
    label: "good",
    attributes: { schema: { version: 1 } },
    provenance: prov("2026-01-01T00:00:00.000Z"),
  });
  g.addNode({ id: "rel-1", type: "Release", label: "r1", provenance: prov() });
  g.addNode({
    id: "deploy-bad",
    type: "Deployment",
    label: "bad",
    attributes: { schemaRequirements: { version: 1 } },
    provenance: prov("2026-01-02T00:00:00.000Z"),
  });
  g.addEdge({ type: "VERIFIED_AGAINST", from: "rel-1", to: "snap-good", provenance: prov() });
  g.addEdge({ type: "DEPENDS_ON", from: "deploy-bad", to: "snap-good", provenance: prov() });
  return g;
}

describe("RecoveryPlanner", () => {
  it("produces deterministic plans for identical inputs", () => {
    const planner = new RecoveryPlanner();
    const graph = buildGraph();
    const ledger = new ChangeLedger();
    ledger.append({
      type: "deployment",
      summary: "bad deploy",
      targetIds: ["deploy-bad"],
      timestamp: "2026-01-02T00:00:00.000Z",
    });
    const input = {
      currentState: graph,
      observedFailure: {
        id: "inc-1",
        title: "outage",
        description: "api failing",
        severity: "high" as const,
        observedAt: "2026-01-02T01:00:00.000Z",
        relatedNodeIds: ["deploy-bad"],
        symptoms: ["5xx"],
        attributes: {},
      },
      policy: { unknownCompatibility: "allow" as const, productionMutation: false },
      ledger,
      now: "2026-01-03T00:00:00.000Z",
    };
    const a = planner.plan(input);
    const b = planner.plan(input);
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
    expect(a.candidateKnownGood).toBe("snap-good");
    expect(a.productionMutation).toBe(false);
    expect(a.operations.some((o) => o.kind === "restore_snapshot" && o.finalizeRestore === false)).toBe(
      true,
    );
  });

  it("records unresolved unknowns when blocked (negative)", () => {
    const planner = new RecoveryPlanner();
    const g = new StateGraph();
    g.addNode({ id: "only", type: "Incident", label: "only", provenance: prov() });
    const plan = planner.plan({
      currentState: g,
      observedFailure: {
        id: "inc-2",
        title: "x",
        description: "y",
        severity: "low",
        observedAt: "2026-01-01T00:00:00.000Z",
        relatedNodeIds: ["only"],
        symptoms: [],
        attributes: {},
      },
      policy: { unknownCompatibility: "block" },
      now: "2026-01-01T00:00:00.000Z",
    });
    expect(plan.candidateKnownGood).toBeNull();
    expect(plan.unresolvedUnknowns.length).toBeGreaterThan(0);
    expect(plan.confidence).toBe(0);
  });
});
