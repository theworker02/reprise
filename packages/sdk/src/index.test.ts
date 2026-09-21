import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RepriseError } from "@reprise/core";
import { MemoryProvider, ProviderRegistry } from "@reprise/providers";
import { Telemetry } from "@reprise/telemetry";
import { RepriseClient } from "./client.js";

function prov(at = "2026-01-01T00:00:00.000Z") {
  return { source: "sdk-test", observedAt: at };
}

describe("RepriseClient", () => {
  it("plans recovery, analyzes impact, and verifies", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reprise-sdk-"));
    const lines: string[] = [];
    const client = new RepriseClient({
      rootDir: dir,
      telemetry: new Telemetry({
        sink: (l) => lines.push(l),
        now: () => "2026-01-03T00:00:00.000Z",
      }),
      providers: new ProviderRegistry(),
    });

    const g = client.getGraph();
    g.addNode({
      id: "snap-good",
      type: "DatabaseSnapshot",
      label: "good",
      attributes: { schema: { version: 1 } },
      provenance: prov(),
    });
    g.addNode({ id: "rel-1", type: "Release", label: "r1", provenance: prov() });
    g.addNode({
      id: "deploy-1",
      type: "Deployment",
      label: "api",
      attributes: { schemaRequirements: { version: 1 } },
      provenance: prov("2026-01-02T00:00:00.000Z"),
    });
    g.addEdge({ type: "VERIFIED_AGAINST", from: "rel-1", to: "snap-good", provenance: prov() });
    g.addEdge({ type: "DEPENDS_ON", from: "deploy-1", to: "snap-good", provenance: prov() });

    client.observeChange({
      type: "deployment",
      summary: "deploy",
      targetIds: ["deploy-1"],
      timestamp: "2026-01-02T00:00:00.000Z",
    });

    const impact = client.analyzeImpact("snap-good");
    expect(impact.impactedNodeIds).toContain("deploy-1");

    const plan = client.createRecoveryPlan(
      {
        id: "inc-1",
        title: "outage",
        description: "failing",
        severity: "high",
        observedAt: "2026-01-02T01:00:00.000Z",
        relatedNodeIds: ["deploy-1"],
        symptoms: ["5xx"],
        attributes: {},
      },
      { unknownCompatibility: "allow", productionMutation: false },
    );
    expect(plan.candidateKnownGood).toBe("snap-good");

    const receipt = await client.verifyTarget({
      targetId: "snap-good",
      plan,
      now: "2026-01-03T00:00:00.000Z",
      attributes: { healthy: true, expectedSchemaVersion: 1, schemaVersion: 1, smokePassed: true },
    });
    expect(receipt.status).toBe("verified");

    client.registerProvider(new MemoryProvider("memory"));
    const restore = await client.restoreViaProvider("memory", { snapshotId: "snap-good" });
    expect(restore.finalize_restore).toBe(false);

    client.save();
    client.verifyLedgerIntegrity();

    const metrics = client.telemetry.snapshot();
    expect(metrics.observed_changes).toBe(1);
    expect(metrics.recovery_plans).toBe(1);
    expect(lines.length).toBeGreaterThan(0);

    rmSync(dir, { recursive: true, force: true });
  });

  it("denies plans that violate policy (negative)", () => {
    const dir = mkdtempSync(join(tmpdir(), "reprise-sdk-deny-"));
    const configPath = join(dir, "reprise.yaml");
    writeFileSync(
      configPath,
      `
project:
  name: demo
provider:
  name: memory
policy:
  never_mutate_production: true
  block_unknown_compatibility: true
  minimum_evidence_count: 100
`,
    );
    const client = new RepriseClient({ rootDir: dir });
    client.loadConfiguration(configPath);
    client.getGraph().addNode({
      id: "n1",
      type: "Incident",
      label: "n1",
      provenance: prov(),
    });
    expect(() =>
      client.createRecoveryPlan({
        id: "inc",
        title: "t",
        description: "d",
        severity: "low",
        observedAt: "2026-01-01T00:00:00.000Z",
        relatedNodeIds: ["n1"],
        symptoms: [],
        attributes: {},
      }),
    ).toThrow(RepriseError);
    rmSync(dir, { recursive: true, force: true });
  });
});
