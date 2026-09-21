import { ChangeLedger } from "@reprise/ledger";
import { PolicyEngine, parsePolicy } from "@reprise/policy";
import { CheckpointStore, RecoveryGuard, TimeMachine, buildRecoverabilitySignal, createRecoveryReceipt } from "@reprise/recovery";
import { VerificationEngine } from "@reprise/verifier";

export interface AcquisitionDemoResult {
  readonly checkpointId: string;
  readonly candidateId: string;
  readonly boundary: readonly string[];
  readonly verification: string;
  readonly guard: string;
  readonly receiptId: string;
  readonly signal: string;
}

/** Fully local deterministic fixture; it does not call Neon or mutate any backend. */
export async function runAcquisitionDemo(): Promise<AcquisitionDemoResult> {
  const store = new CheckpointStore();
  const checkpoint = store.create({
    id: "checkpoint-v17",
    organizationId: "demo-org",
    projectId: "broken-deployment",
    environment: "production",
    provider: "fixture",
    stateRevision: "production-rev-17",
    createdAt: "2026-09-21T14:07:00.000Z",
    actor: "release-bot",
    agentSession: "agent-session-181",
    gitSha: "17a17a17",
    components: [
      { kind: "application", id: "v1.7" },
      { kind: "database_branch", id: "main@checkpoint-8f2c" },
      { kind: "schema", id: "S12" },
      { kind: "migration", id: "M038" },
      { kind: "function", id: "api-users@81e3" },
      { kind: "storage_contract", id: "C6" },
      { kind: "auth_configuration", id: "auth@31" },
      { kind: "environment", id: "env@44" },
      { kind: "dependency_lockset", id: "lockset@18" },
    ],
    compatibility: "COMPATIBLE",
    evidence: [{ kind: "verification", description: "v1.7 full recovery suite passed", weight: 3 }],
  });
  const ledger = new ChangeLedger();
  ledger.append({ id: "migration-039", type: "migration", timestamp: "2026-09-21T14:10:00.000Z", actor: "agent-session-182", summary: "Applied migration M039", targetIds: ["migration-M039", "schema-S13"] });
  ledger.append({ id: "function-902a", type: "function_deployment", timestamp: "2026-09-21T14:11:00.000Z", actor: "agent-session-182", summary: "Deployed api-users@902a", targetIds: ["function-api-users-902a"] });
  ledger.append({ id: "deploy-18", type: "deployment", timestamp: "2026-09-21T14:12:00.000Z", actor: "agent-session-182", summary: "Deployed v1.8", targetIds: ["deployment-v18", "function-api-users-902a", "migration-M039"] });
  const incident = { id: "incident-acquisition", title: "Users API integrity failures", description: "v1.8 function expects an incompatible data shape", severity: "critical" as const, observedAt: "2026-09-21T14:13:00.000Z", relatedNodeIds: ["deployment-v18", "function-api-users-902a", "migration-M039"], symptoms: ["5xx rate increase", "integrity violation"], attributes: { source: "fixture" } };
  const reconstruction = new TimeMachine().reconstruct({ incident, checkpoints: store.list(), ledger });
  if (!reconstruction.candidate) throw new Error("fixture expected a compatible candidate");
  const verification = await new VerificationEngine().verify({ targetId: reconstruction.candidate.id, now: "2026-09-21T14:14:00.000Z", attributes: { healthy: true, migrations: ["M038"], expectedSchemaVersion: "S12", schemaVersion: "S12", smokePassed: true, apiHealthy: true, dataIntegrityOk: true } }, { checks: ["health", "migration", "schema", "smoke", "api", "data_integrity"] });
  const guard = new RecoveryGuard(new PolicyEngine(parsePolicy({ never_mutate_production: true, block_unknown_compatibility: true, required_verification_checks: ["health", "schema", "api", "data_integrity"] }))).evaluate({ candidate: reconstruction.candidate, currentStateRevision: "production-rev-17", verification, promote: false });
  const receipt = createRecoveryReceipt({ incidentId: incident.id, candidate: reconstruction.candidate, createdAt: "2026-09-21T14:14:00.000Z", guard, verificationReceipt: verification });
  const signal = buildRecoverabilitySignal({ checkpoint, currentStateRevision: "production-rev-17", verification, generatedAt: "2026-09-21T14:14:00.000Z" });
  return { checkpointId: checkpoint.id, candidateId: reconstruction.candidate.id, boundary: reconstruction.boundary.candidateChangeIds, verification: verification.status, guard: guard.decision, receiptId: receipt.id, signal: signal.status };
}
