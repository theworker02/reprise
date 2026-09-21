#!/usr/bin/env node
import { runAcquisitionDemo } from "./demo.js";

function printJson(value: unknown): void { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

async function main(argv: readonly string[]): Promise<void> {
  const [command, subcommand, ...rest] = argv;
  const json = rest.includes("--json") || subcommand === "--json";
  if (command === "demo" && subcommand === "acquisition") {
    const result = await runAcquisitionDemo();
    if (json) return printJson(result);
    process.stdout.write(["REPRISE ACQUISITION DEMO (local deterministic fixture)", "", "Incident: Users API integrity failures", `Change boundary: ${result.boundary.join(", ")}`, `Recovery candidate: ${result.candidateId} from ${result.checkpointId}`, `Verification: ${result.verification.toUpperCase()}`, `Recovery Signal: ${result.signal}`, `Recovery Guard: ${result.guard.toUpperCase()} (no production mutation)`, `Recovery receipt: ${result.receiptId}`].join("\n") + "\n");
    return;
  }
  if (command === "--help" || !command) {
    process.stdout.write("Reprise — recover the whole backend, not just the database.\n\nCommands:\n  reprise demo acquisition [--json]  Run deterministic local recovery scenario\n\nThis release intentionally exposes no production restore command.\n");
    return;
  }
  throw new Error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`reprise: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
