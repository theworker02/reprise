import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RepriseError } from "@reprise/core";
import { StateGraph } from "./graph.js";
import { GraphStore } from "./store.js";

function prov(at = "2026-01-01T00:00:00.000Z") {
  return { source: "test", observedAt: at };
}

describe("StateGraph", () => {
  it("adds immutable nodes and edges with checksums", () => {
    const g = new StateGraph();
    const deploy = g.addNode({
      id: "deploy-1",
      type: "Deployment",
      label: "api@1",
      provenance: prov(),
    });
    const schema = g.addNode({
      id: "schema-1",
      type: "SchemaRevision",
      label: "schema@1",
      provenance: prov(),
    });
    const edge = g.addEdge({
      type: "DEPENDS_ON",
      from: "deploy-1",
      to: "schema-1",
      provenance: prov(),
    });
    expect(deploy.immutable).toBe(true);
    expect(deploy.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(edge.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(g.dependencies("deploy-1")).toEqual(["schema-1"]);
    expect(g.dependents("schema-1")).toEqual(["deploy-1"]);
  });

  it("versions nodes without mutating historical body fields", () => {
    const g = new StateGraph();
    g.addNode({ id: "db-1", type: "DatabaseBranch", label: "main", provenance: prov() });
    const v2 = g.versionNode("db-1", {
      label: "main-v2",
      provenance: prov("2026-01-02T00:00:00.000Z"),
      attributes: { branch: "main" },
    });
    const old = g.getNode("db-1");
    expect(old.supersededBy).toBe(v2.id);
    expect(old.label).toBe("main");
    expect(v2.version).toBe(2);
  });

  it("computes blast radius and known-good candidates", () => {
    const g = new StateGraph();
    g.addNode({ id: "snap-1", type: "DatabaseSnapshot", label: "good", provenance: prov() });
    g.addNode({ id: "rel-1", type: "Release", label: "r1", provenance: prov() });
    g.addNode({ id: "fn-1", type: "FunctionRevision", label: "fn", provenance: prov() });
    g.addEdge({
      type: "DEPENDS_ON",
      from: "fn-1",
      to: "snap-1",
      provenance: prov(),
    });
    g.addEdge({
      type: "VERIFIED_AGAINST",
      from: "rel-1",
      to: "snap-1",
      provenance: prov(),
    });
    const radius = g.blastRadius("snap-1");
    expect(radius.impactedNodeIds).toContain("fn-1");
    const known = g.knownGoodStates();
    expect(known.map((n) => n.id)).toEqual(["snap-1"]);
    const candidates = g.recoveryCandidates();
    expect(candidates[0]?.nodeId).toBe("snap-1");
    expect(candidates[0]?.verifiedAgainst).toContain("rel-1");
  });

  it("rejects duplicate nodes and missing edge endpoints (negative)", () => {
    const g = new StateGraph();
    g.addNode({ id: "a", type: "Release", label: "a", provenance: prov() });
    expect(() => g.addNode({ id: "a", type: "Release", label: "a", provenance: prov() })).toThrow(
      RepriseError,
    );
    expect(() =>
      g.addEdge({ type: "DEPENDS_ON", from: "a", to: "missing", provenance: prov() }),
    ).toThrow(RepriseError);
  });

  it("serializes deterministically and persists", () => {
    const g = new StateGraph();
    g.addNode({ id: "b", type: "Release", label: "b", provenance: prov() });
    g.addNode({ id: "a", type: "Release", label: "a", provenance: prov() });
    const s1 = g.serialize();
    const s2 = g.serialize();
    expect(s1).toBe(s2);

    const dir = mkdtempSync(join(tmpdir(), "reprise-graph-"));
    const store = new GraphStore({ rootDir: dir, graphDir: ".reprise/graph" });
    store.save(g);
    const loaded = store.load();
    expect(loaded.listNodes().map((n) => n.id)).toEqual(["a", "b"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects corrupted checksum on deserialize (negative)", () => {
    const g = new StateGraph();
    g.addNode({ id: "x", type: "Incident", label: "x", provenance: prov() });
    const json = JSON.parse(g.serialize()) as { checksum: string };
    json.checksum = "deadbeef";
    expect(() => StateGraph.deserialize(JSON.stringify(json))).toThrow(RepriseError);
  });

  it("fails load when missing (negative)", () => {
    const dir = mkdtempSync(join(tmpdir(), "reprise-graph-empty-"));
    mkdirSync(join(dir, ".reprise"), { recursive: true });
    const store = new GraphStore({ rootDir: dir });
    expect(() => store.load()).toThrow(RepriseError);
    rmSync(dir, { recursive: true, force: true });
  });
});
