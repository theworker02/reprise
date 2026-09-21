import {
  type BlastRadius,
  type CompatibilityResult,
  type Incident,
  type RecoveryPlan,
  type RepriseConfig,
  type VerificationReceipt,
  loadConfig,
  policyDenied,
} from "@reprise/core";
import { CompatibilityEngine } from "@reprise/compatibility";
import { GraphStore, StateGraph } from "@reprise/graph";
import { ChangeLedger, LedgerStore } from "@reprise/ledger";
import { RecoveryPlanner, type PlannerPolicy } from "@reprise/planner";
import { PolicyEngine, parsePolicy, type PolicyDocument, type PolicyEvaluation } from "@reprise/policy";
import {
  ProviderRegistry,
  globalProviderRegistry,
  type Provider,
  type RestoreSnapshotOptions,
  type RestoreResult,
} from "@reprise/providers";
import {
  CheckpointStore,
  RecoveryGuard,
  TimeMachine,
  createRecoveryReceipt,
  type BackendCheckpoint,
  type CheckpointInput,
  type ReconstructionResult,
  type RecoveryReceipt,
} from "@reprise/recovery";
import { Telemetry } from "@reprise/telemetry";
import { VerificationEngine, type VerificationContext, type VerifyOptions } from "@reprise/verifier";

export interface RepriseClientOptions {
  readonly rootDir?: string;
  readonly configPath?: string;
  readonly config?: RepriseConfig;
  readonly telemetry?: Telemetry;
  readonly providers?: ProviderRegistry;
}

/**
 * Public SDK wrapping graph, ledger, planner, compatibility, verifier, policy, and impact analysis.
 */
export class RepriseClient {
  readonly rootDir: string;
  readonly telemetry: Telemetry;
  readonly graphStore: GraphStore;
  readonly ledgerStore: LedgerStore;
  readonly compatibility: CompatibilityEngine;
  readonly planner: RecoveryPlanner;
  readonly verifier: VerificationEngine;
  readonly providers: ProviderRegistry;
  private policyEngine: PolicyEngine;
  private config: RepriseConfig | null;
  private graph: StateGraph;
  private ledger: ChangeLedger;
  private readonly checkpoints = new CheckpointStore();
  private readonly timeMachine = new TimeMachine();

  constructor(options: RepriseClientOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.telemetry = options.telemetry ?? new Telemetry();
    this.graphStore = new GraphStore({ rootDir: this.rootDir });
    this.ledgerStore = new LedgerStore({ rootDir: this.rootDir });
    this.compatibility = new CompatibilityEngine();
    this.planner = new RecoveryPlanner(this.compatibility);
    this.verifier = new VerificationEngine();
    this.providers = options.providers ?? globalProviderRegistry;
    this.config = options.config ?? null;
    this.policyEngine = new PolicyEngine(
      this.config
        ? parsePolicy({
            never_mutate_production: this.config.policy.never_mutate_production,
            require_verified_before_promotion: this.config.policy.require_verified_before_promotion,
            block_unknown_compatibility: this.config.policy.block_unknown_compatibility,
            required_verification_checks: this.config.policy.required_verification_checks,
            max_candidate_age: this.config.policy.max_candidate_age,
            minimum_evidence_count: this.config.policy.minimum_evidence_count,
          })
        : undefined,
    );
    this.graph = this.graphStore.tryLoad() ?? new StateGraph();
    this.ledger = this.ledgerStore.loadOrCreate();
    this.telemetry.set("graph_size", this.graph.size.nodes);

    if (!this.config && options.configPath) {
      this.loadConfiguration(options.configPath);
    }
  }

  loadConfiguration(path = "reprise.yaml"): RepriseConfig {
    this.config = loadConfig(path);
    this.policyEngine = new PolicyEngine(
      parsePolicy({
        never_mutate_production: this.config.policy.never_mutate_production,
        require_verified_before_promotion: this.config.policy.require_verified_before_promotion,
        block_unknown_compatibility: this.config.policy.block_unknown_compatibility,
        required_verification_checks: this.config.policy.required_verification_checks,
        max_candidate_age: this.config.policy.max_candidate_age,
        minimum_evidence_count: this.config.policy.minimum_evidence_count,
      }),
    );
    this.telemetry.info("config.loaded", { path, project: this.config.project.name });
    return this.config;
  }

  getConfig(): RepriseConfig | null {
    return this.config;
  }

  getGraph(): StateGraph {
    return this.graph;
  }

  getLedger(): ChangeLedger {
    return this.ledger;
  }

  createCheckpoint(input: CheckpointInput): BackendCheckpoint {
    const checkpoint = this.checkpoints.create(input);
    this.telemetry.incr("checkpoints_created");
    this.telemetry.info("checkpoint.created", { checkpointId: checkpoint.id, provider: checkpoint.provider });
    return checkpoint;
  }

  listCheckpoints(scope?: { readonly projectId?: string; readonly environment?: string }): BackendCheckpoint[] {
    return this.checkpoints.list(scope);
  }

  reconstructIncident(incident: Incident): ReconstructionResult {
    const result = this.timeMachine.reconstruct({ incident, checkpoints: this.checkpoints.list(), ledger: this.ledger });
    this.telemetry.incr("incidents_analyzed");
    return result;
  }

  getPolicy(): PolicyDocument {
    return this.policyEngine.document;
  }

  save(): void {
    this.graphStore.save(this.graph);
    this.ledgerStore.save(this.ledger);
    this.telemetry.set("graph_size", this.graph.size.nodes);
    this.telemetry.info("state.saved", {
      nodes: this.graph.size.nodes,
      edges: this.graph.size.edges,
      ledgerEntries: this.ledger.length,
    });
  }

  observeChange(
    input: Parameters<ChangeLedger["append"]>[0],
  ): ReturnType<ChangeLedger["append"]> {
    const entry = this.ledger.append(input);
    this.telemetry.incr("observed_changes");
    this.telemetry.info("change.observed", { type: entry.type, id: entry.id });
    return entry;
  }

  verifyLedgerIntegrity(): ReturnType<ChangeLedger["verifyIntegrity"]> {
    return this.ledger.verifyIntegrity();
  }

  analyzeImpact(nodeId: string, maxDepth?: number): BlastRadius {
    const radius = this.graph.blastRadius(nodeId, maxDepth);
    this.telemetry.info("impact.analyzed", {
      originId: nodeId,
      impacted: radius.impactedNodeIds.length,
    });
    return radius;
  }

  evaluateCompatibility(
    fromId: string,
    toId: string,
  ): CompatibilityResult {
    return this.compatibility.evaluate({
      from: fromId,
      to: toId,
      graph: this.graph,
    });
  }

  createRecoveryPlan(failure: Incident, policy?: PlannerPolicy): RecoveryPlan {
    const started = Date.now();
    const plannerPolicy: PlannerPolicy = {
      productionMutation:
        policy?.productionMutation ?? this.config?.recovery.production_mutation ?? false,
      unknownCompatibility:
        policy?.unknownCompatibility ?? this.config?.policy.unknown_compatibility ?? "block",
      maxCandidates: policy?.maxCandidates ?? this.config?.recovery.max_candidates ?? 5,
      requiredVerificationChecks:
        policy?.requiredVerificationChecks ??
        this.config?.policy.required_verification_checks ??
        ["health", "schema"],
      ephemeralByDefault: policy?.ephemeralByDefault ?? this.config?.recovery.ephemeral_by_default ?? true,
    };

    const plan = this.planner.plan({
      currentState: this.graph,
      observedFailure: failure,
      policy: plannerPolicy,
      ledger: this.ledger,
      now: failure.observedAt,
    });

    const evaluation = this.policyEngine.evaluatePlan(plan);
    this.telemetry.observe("planner_duration", Date.now() - started);
    this.telemetry.incr("recovery_plans");

    if (evaluation.decision === "deny") {
      this.telemetry.warn("plan.denied", { planId: plan.id, reasons: evaluation.reasons });
      throw policyDenied(evaluation.reasons);
    }

    this.telemetry.info("plan.created", {
      planId: plan.id,
      candidate: plan.candidateKnownGood,
      confidence: plan.confidence,
    });
    return plan;
  }

  evaluatePlanPolicy(plan: RecoveryPlan): PolicyEvaluation {
    return this.policyEngine.evaluatePlan(plan);
  }

  async verifyTarget(
    ctx: VerificationContext,
    options?: VerifyOptions,
  ): Promise<VerificationReceipt> {
    const started = Date.now();
    const receipt = await this.verifier.verify(ctx, options);
    this.telemetry.observe("verification_duration", Date.now() - started);
    if (receipt.status === "failed") {
      this.telemetry.incr("verification_failures");
    }
    this.telemetry.info("verification.completed", {
      id: receipt.id,
      status: receipt.status,
      targetId: receipt.targetId,
    });
    return receipt;
  }

  registerProvider(provider: Provider): void {
    this.providers.register(provider);
    this.telemetry.info("provider.registered", { name: provider.name });
  }

  async restoreViaProvider(
    providerName: string,
    options: RestoreSnapshotOptions,
  ): Promise<RestoreResult> {
    try {
      const provider = this.providers.get(providerName);
      return await provider.restoreSnapshot(options);
    } catch (err) {
      this.telemetry.incr("provider_errors");
      this.telemetry.error("provider.restore_failed", {
        provider: providerName,
        message: (err as Error).message,
      });
      throw err;
    }
  }

  /** Evaluate promotion separately from planning; stale state is always blocked. */
  guardRecovery(args: {
    readonly reconstruction: ReconstructionResult;
    readonly currentStateRevision: string;
    readonly verification?: VerificationReceipt;
    readonly promote: boolean;
    readonly createdAt: string;
    readonly planId?: string;
  }): RecoveryReceipt {
    if (!args.reconstruction.candidate) {
      throw policyDenied(["No compatible candidate available for recovery guard evaluation"]);
    }
    const guard = new RecoveryGuard(this.policyEngine).evaluate({
      candidate: args.reconstruction.candidate,
      currentStateRevision: args.currentStateRevision,
      verification: args.verification,
      promote: args.promote,
    });
    if (guard.decision === "block") {
      this.telemetry.incr("stale_plan_prevention_events");
    }
    return createRecoveryReceipt({
      incidentId: args.reconstruction.incident.id,
      candidate: args.reconstruction.candidate,
      createdAt: args.createdAt,
      guard,
      planId: args.planId,
      verificationReceipt: args.verification,
    });
  }

  /** Replace in-memory graph (e.g. after building historically). */
  setGraph(graph: StateGraph): void {
    this.graph = graph;
    this.telemetry.set("graph_size", graph.size.nodes);
  }

  setLedger(ledger: ChangeLedger): void {
    this.ledger = ledger;
  }
}

export function createRepriseClient(options?: RepriseClientOptions): RepriseClient {
  return new RepriseClient(options);
}
