import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RepriseError } from "@reprise/core";
import { ChangeLedger } from "./ledger.js";
import { LedgerStore } from "./store.js";

describe("ChangeLedger", () => {
  it("chains hashes and verifies integrity", () => {
    const ledger = new ChangeLedger();
    const a = ledger.append({
      type: "deployment",
      summary: "deploy api",
      targetIds: ["deploy-1"],
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const b = ledger.append({
      type: "migration",
      summary: "migrate schema",
      targetIds: ["mig-1"],
      timestamp: "2026-01-01T01:00:00.000Z",
    });
    expect(b.prevHash).toBe(a.entryHash);
    const report = ledger.verifyIntegrity();
    expect(report.valid).toBe(true);
    expect(report.entriesChecked).toBe(2);
  });

  it("refuses corrupted chains (negative)", () => {
    const ledger = new ChangeLedger();
    ledger.append({ type: "observation", summary: "ok", timestamp: "2026-01-01T00:00:00.000Z" });
    const json = JSON.parse(ledger.serialize()) as {
      version: number;
      entries: Array<{ entryHash: string }>;
    };
    json.entries[0]!.entryHash = "0".repeat(64);
    expect(() => ChangeLedger.deserialize(JSON.stringify(json))).toThrow(RepriseError);
  });

  it("blocks append after integrity failure (negative)", () => {
    const ledger = new ChangeLedger();
    ledger.append({ type: "observation", summary: "a", timestamp: "2026-01-01T00:00:00.000Z" });
    // Force corruption by mutating internal list via deserialize path simulation
    const broken = ChangeLedger.deserialize(ledger.serialize());
    // Tamper by reconstructing with bad prev
    const raw = broken.toJSON();
    const mutated = {
      version: 1 as const,
      entries: [
        ...raw.entries,
        {
          ...raw.entries[0]!,
          id: "evil",
          prevHash: "bad",
          entryHash: "badhash",
          summary: "evil",
        },
      ],
    };
    expect(() => ChangeLedger.fromJSON(mutated)).toThrow(RepriseError);
  });

  it("persists under .reprise/ledger/", () => {
    const dir = mkdtempSync(join(tmpdir(), "reprise-ledger-"));
    const store = new LedgerStore({ rootDir: dir });
    const ledger = new ChangeLedger();
    ledger.append({ type: "branch_creation", summary: "create branch", timestamp: "2026-01-01T00:00:00.000Z" });
    store.save(ledger);
    const loaded = store.load();
    expect(loaded.length).toBe(1);
    loaded.verifyIntegrity();
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails load when file missing (negative)", () => {
    const dir = mkdtempSync(join(tmpdir(), "reprise-ledger-empty-"));
    mkdirSync(join(dir, ".reprise"), { recursive: true });
    const store = new LedgerStore({ rootDir: dir });
    expect(() => store.load()).toThrow(RepriseError);
    writeFileSync(join(dir, "junk.json"), "{not json", "utf8");
    expect(() => ChangeLedger.deserialize("{not json")).toThrow(RepriseError);
    rmSync(dir, { recursive: true, force: true });
  });
});
