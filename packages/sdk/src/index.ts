export { RepriseClient, createRepriseClient } from "./client.js";
export type { RepriseClientOptions } from "./client.js";

// Re-export commonly used types for dashboard/CLI consumers
export type {
  RecoveryPlan,
  CompatibilityResult,
  VerificationReceipt,
  Incident,
  BlastRadius,
  ChangeEvent,
  StateNode,
  StateEdge,
} from "@reprise/core";
export { StateGraph, GraphStore } from "@reprise/graph";
export { ChangeLedger, LedgerStore } from "@reprise/ledger";
export { CompatibilityEngine } from "@reprise/compatibility";
export { RecoveryPlanner } from "@reprise/planner";
export { VerificationEngine } from "@reprise/verifier";
export { PolicyEngine, parsePolicy, defaultPolicy } from "@reprise/policy";
export { Telemetry } from "@reprise/telemetry";
export {
  ProviderRegistry,
  MemoryProvider,
  globalProviderRegistry,
} from "@reprise/providers";
