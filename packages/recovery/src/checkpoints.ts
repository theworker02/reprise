import { checksumOf, validationError } from "@reprise/core";
import type { BackendCheckpoint, CheckpointInput, ComponentReference } from "./types.js";

function normalizedComponents(components: readonly ComponentReference[]): ComponentReference[] {
  const ids = new Set<string>();
  const result = components.map((component) => {
    if (!component.kind || !component.id) throw validationError("checkpoint components require kind and id");
    const key = `${component.kind}:${component.id}`;
    if (ids.has(key)) throw validationError(`duplicate checkpoint component ${key}`);
    ids.add(key);
    return { ...component, attributes: component.attributes ? { ...component.attributes } : undefined };
  });
  return result.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}

export function createCheckpoint(input: CheckpointInput): BackendCheckpoint {
  if (!input.organizationId || !input.projectId || !input.stateRevision) {
    throw validationError("checkpoint requires organizationId, projectId, and stateRevision");
  }
  const components = normalizedComponents(input.components);
  const body = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    environment: input.environment,
    provider: input.provider,
    stateRevision: input.stateRevision,
    createdAt: input.createdAt,
    actor: input.actor,
    agentSession: input.agentSession,
    gitSha: input.gitSha,
    components,
    compatibility: input.compatibility,
    evidence: [...(input.evidence ?? [])],
  };
  const id = input.id ?? `ckpt-${checksumOf(body).slice(0, 16)}`;
  return Object.freeze({ ...body, id, integrityHash: checksumOf({ ...body, id }) });
}

export function verifyCheckpoint(checkpoint: BackendCheckpoint): boolean {
  const { integrityHash, id, ...body } = checkpoint;
  return integrityHash === checksumOf({ ...body, id });
}

export function diffCheckpoints(
  before: BackendCheckpoint,
  after: BackendCheckpoint,
): { readonly added: readonly ComponentReference[]; readonly removed: readonly ComponentReference[]; readonly changed: readonly string[] } {
  const byKey = (checkpoint: BackendCheckpoint) => new Map(checkpoint.components.map((c) => [`${c.kind}:${c.id}`, c]));
  const a = byKey(before);
  const b = byKey(after);
  const added = [...b.entries()].filter(([key]) => !a.has(key)).map(([, value]) => value!).sort(componentOrder);
  const removed = [...a.entries()].filter(([key]) => !b.has(key)).map(([, value]) => value!).sort(componentOrder);
  const changed = [...a.keys()].filter((key) => b.has(key) && checksumOf(a.get(key)) !== checksumOf(b.get(key))).sort();
  return { added, removed, changed };
}

function componentOrder(a: ComponentReference, b: ComponentReference): number {
  return `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`);
}
