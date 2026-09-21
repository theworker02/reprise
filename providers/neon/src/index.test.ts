import { describe, expect, it } from "vitest";
import { NeonProvider } from "./index.js";

function response(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

describe("NeonProvider", () => {
  it("uses documented branch endpoints and keeps snapshots unsupported", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new NeonProvider({ projectId: "project-1", apiKey: "secret-not-logged", fetch: async (url, init) => { calls.push({ url: String(url), init }); return response({ branches: [{ id: "br-1", name: "main", created_at: "2026-01-01T00:00:00Z" }] }); } });
    expect((await provider.listBranches())[0]?.id).toBe("br-1");
    expect(calls[0]?.url).toBe("https://console.neon.tech/api/v2/projects/project-1/branches");
    expect(provider.getCapabilities().supportsSnapshotDiscovery).toBe(false);
    expect(() => provider.listSnapshots()).toThrow(/unsupported/i);
  });

  it("creates a branch with a parent reference", async () => {
    let request: RequestInit | undefined;
    const provider = new NeonProvider({ projectId: "project-1", apiKey: "redact-me", fetch: async (_url, init) => { request = init; return response({ branch: { id: "br-2", name: "reprise-recovery", parent_id: "br-1", created_at: "2026-01-01T00:00:00Z" } }); } });
    const branch = await provider.createBranch({ name: "reprise-recovery", from: "br-1", ephemeral: true });
    expect(branch.parentId).toBe("br-1");
    expect(request?.body).toBe(JSON.stringify({ branch: { name: "reprise-recovery", parent_id: "br-1" } }));
  });
});
