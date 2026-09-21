import type { ProviderCapabilities } from "@reprise/core";
import { providerUnsupported, validationError } from "@reprise/core";

export interface BranchInfo {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string;
  readonly createdAt: string;
  readonly ephemeral?: boolean;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface SnapshotInfo {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly sourceBranchId?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface CreateBranchOptions {
  readonly name: string;
  readonly from?: string;
  readonly ephemeral?: boolean;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface CreateSnapshotOptions {
  readonly name: string;
  readonly branchId?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface RestoreSnapshotOptions {
  readonly snapshotId: string;
  readonly targetBranch?: string;
  /** Ephemeral recovery environment by default. */
  readonly ephemeral?: boolean;
  /** MUST default to false — never finalize restore unless explicitly requested. */
  readonly finalize_restore?: boolean;
}

export interface RestoreResult {
  readonly restoreId: string;
  readonly snapshotId: string;
  readonly targetBranch?: string;
  readonly ephemeral: boolean;
  readonly finalize_restore: boolean;
  readonly status: "started" | "completed" | "failed";
  readonly message: string;
}

export interface HealthCheckResult {
  readonly healthy: boolean;
  readonly message: string;
  readonly checkedAt: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Vendor-neutral Provider interface.
 */
export interface Provider {
  readonly name: string;
  getCapabilities(): ProviderCapabilities | Promise<ProviderCapabilities>;
  healthCheck(): Promise<HealthCheckResult> | HealthCheckResult;
  listBranches(): Promise<readonly BranchInfo[]> | readonly BranchInfo[];
  createBranch(options: CreateBranchOptions): Promise<BranchInfo> | BranchInfo;
  deleteBranch(branchId: string): Promise<void> | void;
  listSnapshots(): Promise<readonly SnapshotInfo[]> | readonly SnapshotInfo[];
  createSnapshot(options: CreateSnapshotOptions): Promise<SnapshotInfo> | SnapshotInfo;
  restoreSnapshot(options: RestoreSnapshotOptions): Promise<RestoreResult> | RestoreResult;
}

export async function assertCapability(
  provider: Provider,
  capability: keyof ProviderCapabilities,
): Promise<void> {
  const caps = await provider.getCapabilities();
  if (!caps[capability]) {
    throw providerUnsupported(capability, provider.name);
  }
}

/**
 * Apply restore defaults: ephemeral=true, finalize_restore=false.
 */
export function normalizeRestoreOptions(options: RestoreSnapshotOptions): Required<
  Pick<RestoreSnapshotOptions, "snapshotId" | "ephemeral" | "finalize_restore">
> &
  RestoreSnapshotOptions {
  if (!options.snapshotId) {
    throw validationError("restoreSnapshot requires snapshotId");
  }
  return {
    ...options,
    snapshotId: options.snapshotId,
    ephemeral: options.ephemeral ?? true,
    finalize_restore: options.finalize_restore ?? false,
  };
}
