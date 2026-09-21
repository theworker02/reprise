import { describe, expect, it } from "vitest";
import { VerificationEngine } from "./engine.js";

describe("VerificationEngine", () => {
  it("produces verified receipt when checks pass", async () => {
    const engine = new VerificationEngine();
    const receipt = await engine.verify(
      {
        targetId: "snap-1",
        now: "2026-01-01T00:00:00.000Z",
        attributes: {
          healthy: true,
          expectedSchemaVersion: 2,
          schemaVersion: 2,
          smokePassed: true,
        },
      },
      { checks: ["health", "schema", "smoke"] },
    );
    expect(receipt.status).toBe("verified");
    expect(receipt.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(engine.receiptToJSON(receipt)).id).toBe(receipt.id);
  });

  it("fails and supports failFast (negative)", async () => {
    const engine = new VerificationEngine();
    const receipt = await engine.verify(
      {
        targetId: "snap-1",
        now: "2026-01-01T00:00:00.000Z",
        attributes: { healthy: false, smokePassed: true },
      },
      { checks: ["health", "smoke"], failFast: true },
    );
    expect(receipt.status).toBe("failed");
    expect(receipt.checks).toHaveLength(1);
  });

  it("skips unknown plugins and marks partial/skipped", async () => {
    const engine = new VerificationEngine();
    const receipt = await engine.verify(
      { targetId: "x", now: "2026-01-01T00:00:00.000Z", attributes: { healthy: true } },
      { checks: ["health", "custom_missing"] },
    );
    expect(receipt.checks.find((c) => c.name === "custom_missing")?.status).toBe("skipped");
  });

  it("runs custom plugins", async () => {
    const engine = new VerificationEngine();
    engine.registerPlugin({
      name: "custom",
      run: () => ({
        name: "custom",
        status: "verified",
        message: "ok",
        durationMs: 2,
      }),
    });
    const receipt = await engine.verify(
      { targetId: "x", now: "2026-01-01T00:00:00.000Z" },
      { checks: ["custom"] },
    );
    expect(receipt.status).toBe("verified");
  });
});
