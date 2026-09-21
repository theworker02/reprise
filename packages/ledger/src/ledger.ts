import {
  type ChangeEvent,
  type LedgerEventType,
  GENESIS_HASH,
  checksumOf,
  ledgerCorrupt,
  ledgerIntegrityFailed,
  validationError,
} from "@reprise/core";

export interface AppendEventInput {
  readonly id?: string;
  readonly type: LedgerEventType;
  readonly timestamp?: string;
  readonly actor?: string;
  readonly targetIds?: readonly string[];
  readonly summary: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface IntegrityReport {
  readonly valid: boolean;
  readonly entriesChecked: number;
  readonly genesisHash: string;
  readonly tipHash: string | null;
  readonly errors: readonly string[];
}

function computeEntryHash(parts: {
  id: string;
  type: LedgerEventType;
  timestamp: string;
  actor?: string;
  targetIds: readonly string[];
  summary: string;
  payload: Readonly<Record<string, unknown>>;
  prevHash: string;
}): string {
  return checksumOf(parts);
}

/**
 * Append-only change ledger with cryptographic hash chaining.
 * Never silently accepts a corrupted chain.
 */
export class ChangeLedger {
  private readonly entries: ChangeEvent[] = [];
  private verified = true;

  get length(): number {
    return this.entries.length;
  }

  tipHash(): string {
    if (this.entries.length === 0) return GENESIS_HASH;
    return this.entries[this.entries.length - 1]!.entryHash;
  }

  list(): readonly ChangeEvent[] {
    return this.entries.slice();
  }

  get(index: number): ChangeEvent {
    const entry = this.entries[index];
    if (!entry) {
      throw validationError(`Ledger entry index ${index} out of range (length=${this.entries.length}).`);
    }
    return entry;
  }

  append(input: AppendEventInput): ChangeEvent {
    if (!this.verified) {
      throw ledgerCorrupt(
        "ledger integrity previously failed; refusing further appends until the chain is repaired or reloaded from a valid snapshot",
      );
    }
    const prevHash = this.tipHash();
    const timestamp = input.timestamp ?? new Date().toISOString();
    const targetIds = Object.freeze([...(input.targetIds ?? [])].sort());
    const payload = Object.freeze({ ...(input.payload ?? {}) });
    const id =
      input.id ??
      checksumOf({
        type: input.type,
        timestamp,
        summary: input.summary,
        targetIds,
        prevHash,
      }).slice(0, 16);

    const entryHash = computeEntryHash({
      id,
      type: input.type,
      timestamp,
      actor: input.actor,
      targetIds,
      summary: input.summary,
      payload,
      prevHash,
    });

    const event: ChangeEvent = Object.freeze({
      id,
      type: input.type,
      timestamp,
      actor: input.actor,
      targetIds,
      summary: input.summary,
      payload,
      prevHash,
      entryHash,
    });
    this.entries.push(event);
    return event;
  }

  /**
   * Verify the entire hash chain. Marks the ledger unverified on failure
   * so subsequent appends are refused.
   */
  verifyIntegrity(): IntegrityReport {
    const errors: string[] = [];
    let expectedPrev = GENESIS_HASH;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      if (entry.prevHash !== expectedPrev) {
        const msg = `entry ${i} (${entry.id}) prevHash mismatch`;
        errors.push(msg);
        this.verified = false;
        throw ledgerIntegrityFailed(i, expectedPrev, entry.prevHash);
      }
      const recomputed = computeEntryHash({
        id: entry.id,
        type: entry.type,
        timestamp: entry.timestamp,
        actor: entry.actor,
        targetIds: entry.targetIds,
        summary: entry.summary,
        payload: entry.payload,
        prevHash: entry.prevHash,
      });
      if (recomputed !== entry.entryHash) {
        const msg = `entry ${i} (${entry.id}) entryHash mismatch`;
        errors.push(msg);
        this.verified = false;
        throw ledgerIntegrityFailed(i, recomputed, entry.entryHash);
      }
      expectedPrev = entry.entryHash;
    }

    this.verified = true;
    return {
      valid: true,
      entriesChecked: this.entries.length,
      genesisHash: GENESIS_HASH,
      tipHash: this.entries.length === 0 ? null : this.tipHash(),
      errors,
    };
  }

  toJSON(): { version: 1; entries: readonly ChangeEvent[] } {
    return { version: 1, entries: this.list() };
  }

  static fromJSON(data: { version: number; entries: readonly ChangeEvent[] }): ChangeLedger {
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) {
      throw ledgerCorrupt("invalid ledger JSON shape (expected version:1 and entries[])");
    }
    const ledger = new ChangeLedger();
    for (const entry of data.entries) {
      ledger.entries.push(Object.freeze({ ...entry, targetIds: Object.freeze([...entry.targetIds]), payload: Object.freeze({ ...entry.payload }) }));
    }
    // Always verify on load — never silently accept corruption.
    ledger.verifyIntegrity();
    return ledger;
  }

  serialize(): string {
    return `${JSON.stringify(this.toJSON(), null, 2)}\n`;
  }

  static deserialize(json: string): ChangeLedger {
    let parsed: { version: number; entries: ChangeEvent[] };
    try {
      parsed = JSON.parse(json) as { version: number; entries: ChangeEvent[] };
    } catch (err) {
      throw ledgerCorrupt(`failed to parse ledger JSON: ${(err as Error).message}`);
    }
    return ChangeLedger.fromJSON(parsed);
  }
}
