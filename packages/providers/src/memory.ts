import type { ProviderCapabilities } from "@reprise/core";
import { providerUnsupported, validationError } from "@reprise/core";
import {
  type BranchInfo,
  type CreateBranchOptions,
  type CreateSnapshotOptions,
  type HealthCheckResult,
  type Provider,
  type RestoreResult,
  type RestoreSnapshotOptions,
  type SnapshotInfo,
  normalizeRestoreOptions,
} from "./types.js";

/**
 * In-memory provider used for tests and local dry-runs.
 * Respects capability flags and restore defaults.
 */
export class MemoryProvider implements Provider {
  readonly name: string;
  private readonly caps: ProviderCapabilities;
  private readonly branches = new Map<string, BranchInfo>();
  private readonly snapshots = new Map<string, SnapshotInfo>();
  private restoreSeq = 0;

  constructor(
    name = "memory",
    capabilities: Partial<ProviderCapabilities> = {},
  ) {
    this.name = name;
    this.caps = {
      supportsBranchCreation: true,
      supportsBranchRestore: true,
      supportsSnapshotDiscovery: true,
      supportsEphemeralRecoveryEnvironment: true,
      supportsPointInTimeRestore: false,
      supportsSchemaDiff: false,
      ...capabilities,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return { ...this.caps };
  }

  healthCheck(): HealthCheckResult {
    return {
      healthy: true,
      message: "memory provider ok",
      checkedAt: new Date().toISOString(),
    };
  }

  listBranches(): BranchInfo[] {
    return [...this.branches.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  createBranch(options: CreateBranchOptions): BranchInfo {
    if (!this.caps.supportsBranchCreation) {
      throw providerUnsupported("supportsBranchCreation", this.name);
    }
    const id = `branch-${options.name}`;
    if (this.branches.has(id)) {
      throw validationError(`Branch "${id}" already exists`);
    }
    const branch: BranchInfo = {
      id,
      name: options.name,
      parentId: options.from,
      createdAt: new Date().toISOString(),
      ephemeral: options.ephemeral ?? true,
      attributes: options.attributes,
    };
    this.branches.set(id, branch);
    return branch;
  }

  deleteBranch(branchId: string): void {
    if (!this.branches.has(branchId)) {
      throw validationError(`Branch "${branchId}" not found`);
    }
    this.branches.delete(branchId);
  }

  listSnapshots(): SnapshotInfo[] {
    if (!this.caps.supportsSnapshotDiscovery) {
      throw providerUnsupported("supportsSnapshotDiscovery", this.name);
    }
    return [...this.snapshots.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  createSnapshot(options: CreateSnapshotOptions): SnapshotInfo {
    const id = `snap-${options.name}`;
    const snap: SnapshotInfo = {
      id,
      name: options.name,
      createdAt: new Date().toISOString(),
      sourceBranchId: options.branchId,
      attributes: options.attributes,
    };
    this.snapshots.set(id, snap);
    return snap;
  }

  restoreSnapshot(options: RestoreSnapshotOptions): RestoreResult {
    if (!this.caps.supportsBranchRestore && !this.caps.supportsEphemeralRecoveryEnvironment) {
      throw providerUnsupported("supportsBranchRestore", this.name);
    }
    const normalized = normalizeRestoreOptions(options);
    if (!this.snapshots.has(normalized.snapshotId) && !normalized.snapshotId.startsWith("snap-")) {
      // Allow restore of known ids even if not created in-memory for flexibility in tests
    }
    if (normalized.finalize_restore && !this.caps.supportsBranchRestore) {
      throw providerUnsupported("supportsBranchRestore", this.name);
    }
    this.restoreSeq += 1;
    return {
      restoreId: `restore-${this.restoreSeq}`,
      snapshotId: normalized.snapshotId,
      targetBranch: normalized.targetBranch,
      ephemeral: normalized.ephemeral,
      finalize_restore: normalized.finalize_restore,
      status: "completed",
      message: normalized.finalize_restore
        ? "Restore finalized"
        : "Ephemeral restore completed (finalize_restore=false)",
    };
  }
}
