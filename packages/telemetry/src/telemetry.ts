import { redact, redactRecord } from "@reprise/core";

export type LogLevel = "debug" | "info" | "warn" | "error";

export const METRIC_NAMES = [
  "observed_changes",
  "recovery_plans",
  "candidate_build_time",
  "verification_duration",
  "verification_failures",
  "graph_size",
  "planner_duration",
  "provider_errors",
  "checkpoints_created",
  "incidents_analyzed",
  "stale_plan_prevention_events",
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export interface TelemetryOptions {
  readonly level?: LogLevel;
  readonly redactSecrets?: boolean;
  readonly sink?: (line: string) => void;
  readonly now?: () => string;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Structured JSON-lines logger with secret redaction and in-memory metrics.
 */
export class Telemetry {
  private readonly level: LogLevel;
  private readonly redactSecrets: boolean;
  private readonly sink: (line: string) => void;
  private readonly now: () => string;
  private readonly counters = new Map<MetricName, number>();
  private readonly lines: string[] = [];

  constructor(options: TelemetryOptions = {}) {
    this.level = options.level ?? "info";
    this.redactSecrets = options.redactSecrets ?? true;
    this.sink = options.sink ?? ((line) => this.lines.push(line));
    this.now = options.now ?? (() => new Date().toISOString());
    for (const name of METRIC_NAMES) {
      this.counters.set(name, 0);
    }
  }

  getLogs(): readonly string[] {
    return this.lines.slice();
  }

  clearLogs(): void {
    this.lines.length = 0;
  }

  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const safeFields = fields
      ? this.redactSecrets
        ? redactRecord(fields)
        : { ...fields }
      : undefined;
    const record: LogRecord = {
      level,
      message: this.redactSecrets ? String(redact(message)) : message,
      timestamp: this.now(),
      ...(safeFields ? { fields: safeFields } : {}),
    };
    this.sink(JSON.stringify(record));
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log("debug", message, fields);
  }
  info(message: string, fields?: Record<string, unknown>): void {
    this.log("info", message, fields);
  }
  warn(message: string, fields?: Record<string, unknown>): void {
    this.log("warn", message, fields);
  }
  error(message: string, fields?: Record<string, unknown>): void {
    this.log("error", message, fields);
  }

  incr(name: MetricName, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  set(name: MetricName, value: number): void {
    this.counters.set(name, value);
  }

  observe(name: MetricName, value: number): void {
    // Timing metrics accumulate as totals; callers can also set gauges via set().
    this.incr(name, value);
  }

  getMetric(name: MetricName): number {
    return this.counters.get(name) ?? 0;
  }

  snapshot(): Record<MetricName, number> {
    const out = {} as Record<MetricName, number>;
    for (const name of METRIC_NAMES) {
      out[name] = this.getMetric(name);
    }
    return out;
  }

  resetMetrics(): void {
    for (const name of METRIC_NAMES) {
      this.counters.set(name, 0);
    }
  }
}

export const defaultTelemetry = new Telemetry();
