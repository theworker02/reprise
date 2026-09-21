import type {
  CompatibilityStatus,
  EvidenceItem,
  Incident,
  RecoveryPlan,
  VerificationReceipt,
} from "@reprise/core";

export interface ComponentReference {
  readonly kind: string;
  readonly id: string;
  readonly version?: string;
  readonly providerReference?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/** Immutable, compound reference to a complete backend state; it never copies backend data. */
export interface BackendCheckpoint {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly environment: string;
  readonly provider: string;
  readonly stateRevision: string;
  readonly createdAt: string;
  readonly actor?: string;
  readonly agentSession?: string;
  readonly gitSha?: string;
  readonly components: readonly ComponentReference[];
  readonly compatibility: CompatibilityStatus;
  readonly evidence: readonly EvidenceItem[];
  readonly integrityHash: string;
}

export interface CheckpointInput {
  readonly id?: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly environment: string;
  readonly provider: string;
  readonly stateRevision: string;
  readonly createdAt: string;
  readonly actor?: string;
  readonly agentSession?: string;
  readonly gitSha?: string;
  readonly components: readonly ComponentReference[];
  readonly compatibility: CompatibilityStatus;
  readonly evidence?: readonly EvidenceItem[];
}

export interface ChangeBoundary {
  readonly earliestPossibleChange: string;
  readonly latestPossibleChange: string;
  readonly candidateChangeIds: readonly string[];
  readonly evidence: readonly EvidenceItem[];
  readonly contradictions: readonly string[];
  readonly confidence: number;
}

export interface ReconstructionCandidate {
  readonly id: string;
  readonly checkpointId: string;
  readonly components: readonly ComponentReference[];
  readonly compatibility: CompatibilityStatus;
  readonly evidence: readonly EvidenceItem[];
  readonly unknowns: readonly string[];
  readonly stateRevision: string;
}

export interface ReconstructionResult {
  readonly incident: Incident;
  readonly boundary: ChangeBoundary;
  readonly candidate: ReconstructionCandidate | null;
  readonly consideredCheckpointIds: readonly string[];
}

export type GuardDecision = "allow" | "block";

export interface RecoveryGuardResult {
  readonly decision: GuardDecision;
  readonly reasons: readonly string[];
  readonly expectedStateRevision: string;
}

export interface RecoveryReceipt {
  readonly id: string;
  readonly createdAt: string;
  readonly incidentId: string;
  readonly candidateId: string;
  readonly planId?: string;
  readonly verificationReceipt?: VerificationReceipt;
  readonly guard: RecoveryGuardResult;
  readonly evidence: readonly EvidenceItem[];
  readonly integrityHash: string;
}

export interface RecoveryExecution {
  readonly plan: RecoveryPlan;
  readonly candidate: ReconstructionCandidate;
  readonly receipt: RecoveryReceipt;
}

export type SignalStatus = "READY" | "CONSTRAINED" | "BLOCKED";

/** A compact, auditable posture summary; individual dimensions are always exposed. */
export interface RecoverabilitySignal {
  readonly id: string;
  readonly checkpointId: string;
  readonly stateRevision: string;
  readonly status: SignalStatus;
  readonly generatedAt: string;
  readonly dimensions: Readonly<{
    compatibility: CompatibilityStatus;
    evidenceCount: number;
    verification: "VERIFIED" | "MISSING";
    freshness: "CURRENT" | "STALE";
    unknowns: number;
  }>;
  readonly findings: readonly string[];
  readonly signature: string;
}
