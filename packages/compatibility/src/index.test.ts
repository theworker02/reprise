import { describe, expect, it } from "vitest";
import { StateGraph } from "@reprise/graph";
import { CompatibilityEngine } from "./engine.js";

function prov(at = "2026-01-01T00:00:00.000Z") {
  return { source: "test", observedAt: at };
}

describe("CompatibilityEngine", () => {
  const engine = new CompatibilityEngine();

  it("returns COMPATIBLE when signals match with verification evidence", () => {
    const graph = new StateGraph();
    graph.addNode({
      id: "app",
      type: "Deployment",
      label: "app",
      attributes: {
        schemaRequirements: { version: 2 },
        apiContracts: { users: "v1" },
      },
      provenance: prov(),
    });
    graph.addNode({
      id: "cand",
      type: "DatabaseSnapshot",
      label: "cand",
      attributes: {
        schema: { version: 2 },
        apiContracts: { users: "v1" },
      },
      provenance: prov(),
    });
    graph.addNode({ id: "rel", type: "Release", label: "rel", provenance: prov() });
    graph.addEdge({ type: "VERIFIED_AGAINST", from: "rel", to: "cand", provenance: prov() });

    const result = engine.evaluate({
      from: "app",
      to: "cand",
      graph,
      signals: {
        schemaRequirements: { version: 2 },
        apiContracts: { users: "v1" },
        priorVerification: true,
      },
    });
    expect(result.status).toBe("COMPATIBLE");
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("returns INCOMPATIBLE on schema mismatch", () => {
    const result = engine.evaluate({
      from: {
        id: "a",
        type: "Deployment",
        version: 1,
        label: "a",
        createdAt: prov().observedAt,
        updatedAt: prov().observedAt,
        checksum: "x",
        attributes: {},
        provenance: prov(),
        immutable: true,
      },
      to: {
        id: "b",
        type: "SchemaRevision",
        version: 1,
        label: "b",
        createdAt: prov().observedAt,
        updatedAt: prov().observedAt,
        checksum: "y",
        attributes: { schema: { version: 1 } },
        provenance: prov(),
        immutable: true,
      },
      signals: {
        schemaRequirements: { version: 2 },
        priorVerification: true,
        migrationAncestry: [],
      },
    });
    expect(result.status).toBe("INCOMPATIBLE");
  });

  it("NEVER converts UNKNOWN to COMPATIBLE (negative)", () => {
    const result = engine.evaluate({
      from: {
        id: "a",
        type: "Deployment",
        version: 1,
        label: "a",
        createdAt: prov().observedAt,
        updatedAt: prov().observedAt,
        checksum: "x",
        attributes: {},
        provenance: prov(),
        immutable: true,
      },
      to: {
        id: "b",
        type: "DatabaseSnapshot",
        version: 1,
        label: "b",
        createdAt: prov().observedAt,
        updatedAt: prov().observedAt,
        checksum: "y",
        attributes: {},
        provenance: prov(),
        immutable: true,
      },
      signals: {},
    });
    expect(result.status).toBe("UNKNOWN");
    expect(result.status).not.toBe("COMPATIBLE");
  });
});
