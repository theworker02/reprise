import { describe, expect, it } from "vitest";
import { REDACTED } from "@reprise/core";
import { Telemetry } from "./telemetry.js";

describe("Telemetry", () => {
  it("emits JSON lines and tracks metrics", () => {
    const lines: string[] = [];
    const t = new Telemetry({
      sink: (line) => lines.push(line),
      now: () => "2026-01-01T00:00:00.000Z",
      level: "info",
    });
    t.info("hello", { count: 1 });
    t.incr("observed_changes");
    t.observe("planner_duration", 12);
    t.set("graph_size", 42);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "info",
      message: "hello",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(t.getMetric("observed_changes")).toBe(1);
    expect(t.getMetric("planner_duration")).toBe(12);
    expect(t.snapshot().graph_size).toBe(42);
  });

  it("redacts secrets by default (negative leakage path)", () => {
    const lines: string[] = [];
    const t = new Telemetry({ sink: (line) => lines.push(line), now: () => "t" });
    t.error("failure", { apiKey: "sk_live_abcdefghijklmnop", password: "secret" });
    const parsed = JSON.parse(lines[0]!) as { fields: Record<string, string> };
    expect(parsed.fields["apiKey"]).toBe(REDACTED);
    expect(parsed.fields["password"]).toBe(REDACTED);
  });

  it("respects log level filtering", () => {
    const lines: string[] = [];
    const t = new Telemetry({ sink: (line) => lines.push(line), level: "error", now: () => "t" });
    t.info("nope");
    t.error("yes");
    expect(lines).toHaveLength(1);
  });
});
