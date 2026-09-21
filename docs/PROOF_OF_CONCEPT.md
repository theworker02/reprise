# Reprise proof of concept

## Purpose

This proof of concept demonstrates Reprise's current, executable recovery-reasoning path without requiring credentials, a provider account, or production infrastructure. It is deliberately narrow: it proves the deterministic local behavior that is implemented today and does not imply a completed live recovery integration.

## Scenario

The fixture models a backend change from a known-good `v1.7` state to a failing `v1.8` state:

```text
v1.7 compound checkpoint
├── schema S12
├── function F17
└── storage contract C6

v1.8 observed state
├── deployment v1.8
├── migration M104
├── schema S13
└── function F18
```

The incident evidence points to an incompatible users API function after the v1.8 change. Reprise does not select a recovery state purely because it is older. It identifies the change boundary, reconstructs the compatible v1.7 compound checkpoint, runs verification evidence, evaluates the Recovery Guard, and emits a receipt.

## Run it

Requirements: Node.js 22.13+ and pnpm 11.19.0.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm build
node apps/cli/dist/index.js demo acquisition --json
```

Expected decisive fields:

```json
{
  "checkpointId": "checkpoint-v17",
  "candidateId": "candidate-checkpoint-v17",
  "verification": "verified",
  "guard": "allow",
  "signal": "READY"
}
```

The exact receipt ID is deterministic for the fixture and may be used to inspect the emitted result. The command exits successfully only when the fixture’s expected recovery path completes.

## What this proves

| Claim | Evidence in this repository |
| --- | --- |
| Historical relationships can be represented beyond a database snapshot | Typed State Graph and compound checkpoint tests |
| Change reasoning is not timestamp-only | Change Boundary Engine and fixture boundary output |
| A compatible candidate can be reconstructed deterministically | Time Machine and CLI fixture output |
| Candidate verification is required | Six verification checks in the acquisition fixture |
| A verified candidate still needs a freshness check | Recovery Guard result and receipt integrity tests |
| Uncertainty is not treated as safe | Compatibility and policy negative-path tests |

## Visual walkthrough

The static site contains a motion-enabled, four-frame walkthrough of the same fixture:

1. observe a v1.8 incident;
2. isolate the change boundary;
3. reconstruct the v1.7 compound checkpoint; and
4. verify it and apply the Recovery Guard.

The visual walkthrough is driven by local fixture data. It clearly identifies itself as a sample and does not perform a provider operation, create a branch, restore data, or mutate production. It is intentionally implemented as HTML, CSS, JavaScript, and SVG rather than a downloadable video, so it remains inspectable and small.

## What this does not prove

- A live Neon account has not been used to exercise branch creation, verification, restore, or cleanup.
- Snapshot discovery, point-in-time restore, schema diffing, Functions, Auth, Object Storage, Data API, and AI Gateway integration are not implemented.
- No production promotion executor is shipped.
- Live health and application probes require a future execution adapter.

These boundaries are intentional and are documented in [V1 limitations](V1_LIMITATIONS.md), [Neon provider notes](providers/neon.md), and the [risk register](../acquisition/RISK_REGISTER.md).

## Reproduce full validation

```powershell
pnpm release:validate
```

This executes build, lint, type check, automated tests, the acquisition fixture, and both SBOM generation paths. GitHub Actions runs the same validation suite on pushes and pull requests.
