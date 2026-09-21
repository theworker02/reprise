/**
 * Core domain types for the Reprise control plane.
 */

export const NODE_TYPES = [
  "Deployment",
  "DatabaseBranch",
  "DatabaseSnapshot",
  "SchemaRevision",
  "Migration",
  "FunctionRevision",
  "StorageContract",
  "AuthConfiguration",
  "EnvironmentRevision",
  "DependencySet",
  "Release",
  "Incident",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  "DEPENDS_ON",
  "COMPATIBLE_WITH",
  "CREATED_BY",
  "MIGRATED_FROM",
  "SUPERSEDES",
  "OBSERVED_WITH",
  "VERIFIED_AGAINST",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export type CompatibilityStatus = "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";

export interface Provenance {
  readonly source: string;
  readonly actor?: string;
  readonly observedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StateNode {
  readonly id: string;
  readonly type: NodeType;
  readonly version: number;
  readonly label: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly checksum: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly provenance: Provenance;
  /** When true, this version is historical and must not be mutated. */
  readonly immutable: boolean;
  readonly supersededBy?: string;
}

export interface StateEdge {
  readonly id: string;
  readonly type: EdgeType;
  readonly from: string;
  readonly to: string;
  readonly createdAt: string;
  readonly checksum: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly provenance: Provenance;
  readonly immutable: boolean;
}

export interface EvidenceItem {
  readonly kind: string;
  readonly description: string;
  readonly source?: string;
  readonly weight?: number;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface CompatibilityResult {
  readonly status: CompatibilityStatus;
  readonly reasoning: readonly string[];
  readonly evidence: readonly EvidenceItem[];
  readonly fromId?: string;
  readonly toId?: string;
}

export type RecoveryOperationKind =
  | "restore_snapshot"
  | "create_branch"
  | "rollback_deployment"
  | "rollback_migration"
  | "restore_config"
  | "restore_function"
  | "verify"
  | "promote"
  | "custom";

export interface RecoveryOperation {
  readonly id: string;
  readonly kind: RecoveryOperationKind;
  readonly targetId: string;
  readonly description: string;
  readonly ephemeral: boolean;
  readonly finalizeRestore: boolean;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly dependsOn: readonly string[];
}

export interface VerificationRequirement {
  readonly check: string;
  readonly required: boolean;
  readonly description?: string;
}

export interface RecoveryPlan {
  readonly id: string;
  readonly createdAt: string;
  readonly suspectedChangeBoundary: readonly string[];
  readonly candidateKnownGood: string | null;
  readonly requiredComponents: readonly string[];
  readonly operations: readonly RecoveryOperation[];
  readonly verificationRequirements: readonly VerificationRequirement[];
  readonly confidence: number;
  readonly evidence: readonly EvidenceItem[];
  readonly unresolvedUnknowns: readonly string[];
  readonly productionMutation: boolean;
}

export type VerificationStatus = "verified" | "failed" | "partial" | "skipped";

export interface VerificationCheckResult {
  readonly name: string;
  readonly status: VerificationStatus;
  readonly message: string;
  readonly durationMs: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface VerificationReceipt {
  readonly id: string;
  readonly planId?: string;
  readonly targetId: string;
  readonly status: VerificationStatus;
  readonly createdAt: string;
  readonly checks: readonly VerificationCheckResult[];
  readonly evidence: readonly EvidenceItem[];
  readonly checksum: string;
}

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly observedAt: string;
  readonly relatedNodeIds: readonly string[];
  readonly symptoms: readonly string[];
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface ProviderCapabilities {
  readonly supportsBranchCreation: boolean;
  readonly supportsBranchRestore: boolean;
  readonly supportsSnapshotDiscovery: boolean;
  readonly supportsEphemeralRecoveryEnvironment: boolean;
  readonly supportsPointInTimeRestore: boolean;
  readonly supportsSchemaDiff: boolean;
}

export const LEDGER_EVENT_TYPES = [
  "deployment",
  "migration",
  "rollback",
  "schema_modification",
  "configuration_modification",
  "function_deployment",
  "branch_creation",
  "branch_deletion",
  "dependency_modification",
  "verification_result",
  "observation",
] as const;

export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export interface ChangeEvent {
  readonly id: string;
  readonly type: LedgerEventType;
  readonly timestamp: string;
  readonly actor?: string;
  readonly targetIds: readonly string[];
  readonly summary: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly prevHash: string;
  readonly entryHash: string;
}

export interface BlastRadius {
  readonly originId: string;
  readonly impactedNodeIds: readonly string[];
  readonly depth: number;
  readonly byType: Readonly<Record<string, readonly string[]>>;
}
