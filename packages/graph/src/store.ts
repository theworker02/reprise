import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validationError } from "@reprise/core";
import { StateGraph, type StateGraphSnapshot } from "./graph.js";

const DEFAULT_DIR = ".reprise/graph";
const SNAPSHOT_FILE = "state.json";

export interface GraphStoreOptions {
  readonly rootDir?: string;
  readonly graphDir?: string;
}

/**
 * Persist state graphs as deterministic JSON under .reprise/graph/.
 */
export class GraphStore {
  readonly directory: string;

  constructor(options: GraphStoreOptions = {}) {
    const root = resolve(options.rootDir ?? process.cwd());
    this.directory = resolve(root, options.graphDir ?? DEFAULT_DIR);
  }

  get snapshotPath(): string {
    return join(this.directory, SNAPSHOT_FILE);
  }

  ensureDir(): void {
    mkdirSync(this.directory, { recursive: true });
  }

  save(graph: StateGraph): StateGraphSnapshot {
    this.ensureDir();
    const snapshot = graph.toSnapshot();
    const payload = graph.serialize();
    const tmp = `${this.snapshotPath}.${process.pid}.tmp`;
    writeFileSync(tmp, payload, "utf8");
    renameSync(tmp, this.snapshotPath);
    return snapshot;
  }

  load(): StateGraph {
    if (!existsSync(this.snapshotPath)) {
      throw validationError(
        `No state graph found at ${this.snapshotPath}. Save a graph before loading.`,
        { path: this.snapshotPath },
      );
    }
    const text = readFileSync(this.snapshotPath, "utf8");
    return StateGraph.deserialize(text);
  }

  tryLoad(): StateGraph | null {
    if (!existsSync(this.snapshotPath)) return null;
    return this.load();
  }

  exists(): boolean {
    return existsSync(this.snapshotPath);
  }
}

export function defaultGraphDir(rootDir?: string): string {
  return join(resolve(rootDir ?? process.cwd()), DEFAULT_DIR);
}

export function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}
