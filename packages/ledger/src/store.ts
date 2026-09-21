import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ledgerCorrupt } from "@reprise/core";
import { ChangeLedger } from "./ledger.js";

const DEFAULT_DIR = ".reprise/ledger";
const LEDGER_FILE = "changes.json";

export interface LedgerStoreOptions {
  readonly rootDir?: string;
  readonly ledgerDir?: string;
}

export class LedgerStore {
  readonly directory: string;

  constructor(options: LedgerStoreOptions = {}) {
    const root = resolve(options.rootDir ?? process.cwd());
    this.directory = resolve(root, options.ledgerDir ?? DEFAULT_DIR);
  }

  get path(): string {
    return join(this.directory, LEDGER_FILE);
  }

  ensureDir(): void {
    mkdirSync(this.directory, { recursive: true });
  }

  save(ledger: ChangeLedger): void {
    // Refuse to persist a ledger that fails integrity.
    ledger.verifyIntegrity();
    this.ensureDir();
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, ledger.serialize(), "utf8");
    renameSync(tmp, this.path);
  }

  load(): ChangeLedger {
    if (!existsSync(this.path)) {
      throw ledgerCorrupt(`ledger file not found at ${this.path}`);
    }
    const text = readFileSync(this.path, "utf8");
    return ChangeLedger.deserialize(text);
  }

  tryLoad(): ChangeLedger | null {
    if (!existsSync(this.path)) return null;
    return this.load();
  }

  loadOrCreate(): ChangeLedger {
    return this.tryLoad() ?? new ChangeLedger();
  }
}
