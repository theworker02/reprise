import { checksumOf, validationError, type EvidenceItem, type Incident, type VerificationReceipt } from "@reprise/core";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ChangeLedger } from "@reprise/ledger";
import { PolicyEngine } from "@reprise/policy";
import {
  createCheckpoint,
  diffCheckpoints,
  verifyCheckpoint,
} from "./checkpoints.js";
import type {
  BackendCheckpoint,
  ChangeBoundary,
  ReconstructionCandidate,
  ReconstructionResult,
  RecoveryGuardResult,
  RecoveryReceipt,
  RecoverabilitySignal,
} from "./types.js";

/** In-memory immutable checkpoint index; persistence is deliberately a caller concern. */
export class CheckpointStore {
  private readonly checkpoints = new Map<string, BackendCheckpoint>();

  add(checkpoint: BackendCheckpoint): BackendCheckpoint {
    if (!verifyCheckpoint(checkpoint)) throw new Error(`Checkpoint ${checkpoint.id} integrity verification failed`);
    if (this.checkpoints.has(checkpoint.id)) throw new Error(`Checkpoint ${checkpoint.id} already exists`);
    this.checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  create(input: Parameters<typeof createCheckpoint>[0]): BackendCheckpoint {
    return this.add(createCheckpoint(input));
  }

  get(id: string): BackendCheckpoint {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) throw new Error(`Checkpoint ${id} not found`);
    return checkpoint;
  }

  list(scope?: { readonly projectId?: string; readonly environment?: string }): BackendCheckpoint[] {
    return [...this.checkpoints.values()]
      .filter((item) => (!scope?.projectId || item.projectId === scope.projectId) && (!scope?.environment || item.environment === scope.environment))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
}

/** Durable local checkpoint repository using same-directory atomic replacement. */
export class FileCheckpointStore {
  private readonly path: string;
  private readonly store = new CheckpointStore();

  constructor(options: { readonly rootDir?: string; readonly file?: string } = {}) {
    this.path = resolve(options.rootDir ?? process.cwd(), options.file ?? ".reprise/checkpoints.json");
  }

  load(): CheckpointStore {
    if (!existsSync(this.path)) return this.store;
    const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
    if (!Array.isArray(parsed)) throw validationError("Invalid checkpoint repository: expected an array", { path: this.path });
    for (const value of parsed) {
      if (!value || typeof value !== "object") throw validationError("Invalid checkpoint repository entry", { path: this.path });
      this.store.add(value as BackendCheckpoint);
    }
    return this.store;
  }

  save(store: CheckpointStore = this.store): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(store.list(), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temp, this.path);
  }

  loadOrCreate(): CheckpointStore {
    const loaded = this.load();
    if (!existsSync(this.path)) this.save(loaded);
    return loaded;
  }
}

export class ChangeBoundaryEngine {
  analyze(incident: Incident, ledger: ChangeLedger): ChangeBoundary {
    const incidentTime = Date.parse(incident.observedAt);
    const candidates = ledger.list().filter((event) => Date.parse(event.timestamp) <= incidentTime);
    const related = new Set(incident.relatedNodeIds);
    const relevant = candidates.filter((event) => event.targetIds.some((id) => related.has(id)));
    const selected = (relevant.length > 0 ? relevant : candidates).slice(-20);
    const times = selected.map((event) => event.timestamp).sort();
    const ids = selected.flatMap((event) => event.targetIds).sort();
    const evidence: EvidenceItem[] = selected.map((event) => ({
      kind: "ledger_change",
      description: `${event.type}: ${event.summary}`,
      source: event.id,
      weight: event.targetIds.some((id) => related.has(id)) ? 2 : 1,
      data: { actor: event.actor, timestamp: event.timestamp, targetIds: event.targetIds },
    }));
    const contradictions = selected.filter((event) => Date.parse(event.timestamp) > incidentTime).map((event) => `event ${event.id} is after incident`);
    const direct = selected.filter((event) => event.targetIds.some((id) => related.has(id))).length;
    return {
      earliestPossibleChange: times[0] ?? incident.observedAt,
      latestPossibleChange: times.at(-1) ?? incident.observedAt,
      candidateChangeIds: [...new Set(ids)],
      evidence,
      contradictions,
      confidence: selected.length === 0 ? 0 : Math.min(0.9, 0.25 + direct * 0.2 + Math.min(selected.length, 5) * 0.05),
    };
  }
}

export class TimeMachine {
  constructor(private readonly boundaryEngine = new ChangeBoundaryEngine()) {}

  reconstruct(args: { readonly incident: Incident; readonly checkpoints: readonly BackendCheckpoint[]; readonly ledger: ChangeLedger }): ReconstructionResult {
    const boundary = this.boundaryEngine.analyze(args.incident, args.ledger);
    const beforeIncident = args.checkpoints
      .filter((checkpoint) => checkpoint.createdAt <= args.incident.observedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const compatible = beforeIncident.filter((checkpoint) => checkpoint.compatibility === "COMPATIBLE" && verifyCheckpoint(checkpoint));
    const selected = compatible[0] ?? null;
    const candidate: ReconstructionCandidate | null = selected
      ? {
          id: `candidate-${selected.id}`,
          checkpointId: selected.id,
          components: selected.components,
          compatibility: selected.compatibility,
          evidence: [...selected.evidence, ...boundary.evidence],
          unknowns: [],
          stateRevision: selected.stateRevision,
        }
      : null;
    return { incident: args.incident, boundary, candidate, consideredCheckpointIds: beforeIncident.map((checkpoint) => checkpoint.id) };
  }

  bisect(good: BackendCheckpoint, bad: BackendCheckpoint): { readonly changes: ReturnType<typeof diffCheckpoints>; readonly credible: boolean } {
    return { changes: diffCheckpoints(good, bad), credible: good.compatibility === "COMPATIBLE" && good.createdAt <= bad.createdAt };
  }
}

/** Blocks stale, unknown, unverified, or policy-violating promotion attempts. */
export class RecoveryGuard {
  constructor(private readonly policies: PolicyEngine) {}

  evaluate(args: { readonly candidate: ReconstructionCandidate; readonly currentStateRevision: string; readonly verification?: VerificationReceipt; readonly promote: boolean }): RecoveryGuardResult {
    const reasons: string[] = [];
    if (args.candidate.stateRevision !== args.currentStateRevision) reasons.push("stale_plan: production/backend revision changed after candidate reconstruction");
    const policy = this.policies.evaluateCandidate({
      candidateId: args.candidate.id,
      ageMs: 0,
      evidenceCount: args.candidate.evidence.length,
      compatibilityStatus: args.candidate.compatibility,
      verified: args.verification?.status === "verified",
      promotingToProduction: args.promote,
      mutatesProduction: args.promote,
    });
    reasons.push(...policy.reasons);
    if (args.promote && args.verification?.status !== "verified") reasons.push("promotion requires a verified recovery receipt");
    return { decision: reasons.length === 0 ? "allow" : "block", reasons: [...new Set(reasons)].sort(), expectedStateRevision: args.candidate.stateRevision };
  }
}

export function createRecoveryReceipt(args: { readonly incidentId: string; readonly candidate: ReconstructionCandidate; readonly createdAt: string; readonly guard: RecoveryGuardResult; readonly planId?: string; readonly verificationReceipt?: VerificationReceipt }): RecoveryReceipt {
  const evidence = [...args.candidate.evidence, ...(args.verificationReceipt?.evidence ?? [])];
  const body = { incidentId: args.incidentId, candidateId: args.candidate.id, planId: args.planId, verificationReceipt: args.verificationReceipt, guard: args.guard, evidence, createdAt: args.createdAt };
  const id = `receipt-${checksumOf(body).slice(0, 16)}`;
  return { id, ...body, integrityHash: checksumOf({ id, ...body }) };
}

export function verifyRecoveryReceipt(receipt: RecoveryReceipt): boolean {
  const { integrityHash, ...body } = receipt;
  return integrityHash === checksumOf(body);
}

/**
 * Creates a portable Recovery Signal from evidence already held by Reprise.
 * It deliberately exposes dimensions instead of collapsing risk into a score.
 */
export function buildRecoverabilitySignal(args: {
  readonly checkpoint: BackendCheckpoint;
  readonly currentStateRevision: string;
  readonly verification?: VerificationReceipt;
  readonly unknowns?: readonly string[];
  readonly generatedAt: string;
}): RecoverabilitySignal {
  const unknowns = [...(args.unknowns ?? [])].sort();
  const freshness = args.checkpoint.stateRevision === args.currentStateRevision ? "CURRENT" : "STALE";
  const verification = args.verification?.status === "verified" ? "VERIFIED" : "MISSING";
  const compatibility = args.checkpoint.compatibility;
  const findings = [
    ...(compatibility !== "COMPATIBLE" ? [`compatibility is ${compatibility}`] : []),
    ...(freshness !== "CURRENT" ? ["checkpoint revision differs from observed backend revision"] : []),
    ...(verification !== "VERIFIED" ? ["no verified recovery receipt is attached"] : []),
    ...unknowns,
  ].sort();
  const status: RecoverabilitySignal["status"] = compatibility !== "COMPATIBLE" || freshness === "STALE" || unknowns.length > 0
    ? "BLOCKED"
    : verification === "VERIFIED" ? "READY" : "CONSTRAINED";
  const dimensions = { compatibility, evidenceCount: args.checkpoint.evidence.length, verification, freshness, unknowns: unknowns.length } as const;
  const body = { checkpointId: args.checkpoint.id, stateRevision: args.checkpoint.stateRevision, status, generatedAt: args.generatedAt, dimensions, findings };
  return { id: `signal-${checksumOf(body).slice(0, 16)}`, ...body, signature: checksumOf(body) };
}
