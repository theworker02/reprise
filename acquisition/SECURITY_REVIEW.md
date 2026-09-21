# Security review summary

## Verified controls

- API keys are runtime-only in the Neon adapter; request failures redact Bearer tokens.
- Reprise does not serialize API keys in checkpoints, receipts, demo fixtures, or configuration examples.
- Verification and promotion are separate. The Recovery Guard blocks stale revisions and policy violations.
- Unsupported provider actions throw explicit errors; no fallback mutates production.
- Checkpoint and receipt integrity is SHA-256 based and unit-tested.

## Open findings

See [RISK_REGISTER.md](RISK_REGISTER.md). Live API validation, signed webhook ingestion, authorization, secret scanning, and keyed/signature-backed receipts remain release blockers.
