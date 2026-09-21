import { providerUnsupported, validationError, type ProviderCapabilities } from "@reprise/core";
import type { BranchInfo, CreateBranchOptions, CreateSnapshotOptions, HealthCheckResult, Provider, RestoreResult, RestoreSnapshotOptions, SnapshotInfo } from "@reprise/providers";

const API_BASE_URL = "https://console.neon.tech/api/v2";

export interface NeonProviderOptions {
  readonly projectId: string;
  /** Supply at runtime; never persist this value in Reprise configuration or checkpoints. */
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
  readonly baseUrl?: string;
}

interface NeonBranch { readonly id?: unknown; readonly name?: unknown; readonly parent_id?: unknown; readonly created_at?: unknown; readonly [key: string]: unknown; }

/**
 * Neon Management API adapter limited to documented branch lifecycle primitives.
 * Snapshot operations deliberately remain unsupported until their public API
 * contract is documented and covered by a provider contract test.
 */
export class NeonProvider implements Provider {
  readonly name = "neon";
  private readonly requestFetch: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly options: NeonProviderOptions) {
    if (!options.projectId.trim()) throw validationError("Neon projectId is required");
    if (!options.apiKey.trim()) throw validationError("Neon apiKey is required");
    this.requestFetch = options.fetch ?? fetch;
    this.endpoint = (options.baseUrl ?? API_BASE_URL).replace(/\/$/, "");
  }

  getCapabilities(): ProviderCapabilities {
    return { supportsBranchCreation: true, supportsBranchRestore: false, supportsSnapshotDiscovery: false, supportsEphemeralRecoveryEnvironment: true, supportsPointInTimeRestore: false, supportsSchemaDiff: false };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const branches = await this.listBranches();
      return { healthy: true, message: `Neon Management API reachable; ${branches.length} branch(es) observed`, checkedAt: new Date().toISOString() };
    } catch (error) {
      return { healthy: false, message: `Neon Management API check failed: ${safeMessage(error)}`, checkedAt: new Date().toISOString() };
    }
  }

  async listBranches(): Promise<readonly BranchInfo[]> {
    const body = await this.request(`/projects/${encodeURIComponent(this.options.projectId)}/branches`, "GET");
    if (!body || typeof body !== "object" || !Array.isArray((body as { branches?: unknown }).branches)) throw validationError("Neon API response did not contain branches[]");
    return (body as { branches: NeonBranch[] }).branches.map((branch) => this.toBranch(branch)).sort((a, b) => a.id.localeCompare(b.id));
  }

  async createBranch(options: CreateBranchOptions): Promise<BranchInfo> {
    if (!options.name.trim()) throw validationError("Neon branch name is required");
    const branch: Record<string, unknown> = { name: options.name };
    if (options.from) branch.parent_id = options.from;
    const body = await this.request(`/projects/${encodeURIComponent(this.options.projectId)}/branches`, "POST", { branch });
    if (!body || typeof body !== "object" || !("branch" in body)) throw validationError("Neon API response did not contain branch");
    const created = this.toBranch((body as { branch: NeonBranch }).branch);
    return { ...created, ephemeral: options.ephemeral ?? true, attributes: options.attributes };
  }

  async deleteBranch(branchId: string): Promise<void> {
    if (!branchId) throw validationError("Neon branchId is required");
    await this.request(`/projects/${encodeURIComponent(this.options.projectId)}/branches/${encodeURIComponent(branchId)}`, "DELETE");
  }

  listSnapshots(): readonly SnapshotInfo[] { throw providerUnsupported("supportsSnapshotDiscovery", this.name); }
  createSnapshot(_options: CreateSnapshotOptions): SnapshotInfo { throw providerUnsupported("supportsSnapshotDiscovery", this.name); }
  restoreSnapshot(_options: RestoreSnapshotOptions): RestoreResult { throw providerUnsupported("supportsBranchRestore", this.name); }

  private async request(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<unknown> {
    const response = await this.requestFetch(`${this.endpoint}${path}`, { method, headers: { accept: "application/json", authorization: `Bearer ${this.options.apiKey}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Neon API ${method} ${path} failed with HTTP ${response.status}`);
    if (response.status === 204) return undefined;
    return response.json();
  }

  private toBranch(branch: NeonBranch): BranchInfo {
    if (typeof branch.id !== "string" || typeof branch.name !== "string" || typeof branch.created_at !== "string") throw validationError("Neon branch response missing id, name, or created_at");
    return { id: branch.id, name: branch.name, ...(typeof branch.parent_id === "string" ? { parentId: branch.parent_id } : {}), createdAt: branch.created_at, attributes: { provider: "neon" } };
  }
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "unknown error").replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
}
