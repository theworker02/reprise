import { describe, expect, it } from "vitest";
import { RepriseError } from "@reprise/core";
import { MemoryProvider } from "./memory.js";
import { ProviderRegistry } from "./registry.js";
import { normalizeRestoreOptions } from "./types.js";

describe("providers", () => {
  it("registers and resolves providers", () => {
    const registry = new ProviderRegistry();
    const mem = new MemoryProvider("memory");
    registry.register(mem);
    expect(registry.list()).toEqual(["memory"]);
    expect(registry.get("memory").name).toBe("memory");
  });

  it("throws for missing providers (negative)", () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get("neon")).toThrow(RepriseError);
  });

  it("defaults finalize_restore to false", async () => {
    const provider = new MemoryProvider();
    provider.createSnapshot({ name: "s1" });
    const result = await provider.restoreSnapshot({ snapshotId: "snap-s1" });
    expect(result.finalize_restore).toBe(false);
    expect(result.ephemeral).toBe(true);
    expect(normalizeRestoreOptions({ snapshotId: "x" }).finalize_restore).toBe(false);
  });

  it("rejects unsupported capabilities (negative)", async () => {
    const provider = new MemoryProvider("limited", {
      supportsBranchCreation: false,
      supportsSnapshotDiscovery: false,
    });
    expect(() => provider.createBranch({ name: "x" })).toThrow(RepriseError);
    expect(() => provider.listSnapshots()).toThrow(RepriseError);
  });
});
