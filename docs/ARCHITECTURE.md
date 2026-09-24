# Reprise — architecture

Reprise is a local-first recovery and compatibility control plane for changing backends. The vendor-neutral core is isolated from provider-specific actions.

## Component graph

```mermaid
flowchart LR
  CLI[CLI / SDK] --> Core[Core domain types]
  Core --> Graph[State Graph]
  Core --> Ledger[Change Ledger]
  Graph --> Compatibility[Compatibility engine]
  Ledger --> Planner[Recovery planner]
  Compatibility --> Planner
  Planner --> Recovery[Time Machine + Guard]
  Recovery --> Verifier[Verification engine]
  Providers[Capability-based providers] --> Recovery
  Neon[Neon branch adapter] --> Providers
```

## Invariants

- Observations in the graph and ledger are immutable evidence—not inferred marketing state.
- Providers advertise only capabilities they implement; planning refuses unsafe promotion by default.
- Recovery reconstructs compound checkpoints and verifies candidates in isolation before promotion.

## Deep dives

| Document | Contents |
| --- | --- |
| [V1_ARCHITECTURE.md](./V1_ARCHITECTURE.md) | Detailed v1 architecture and recovery reasoning |
| [../acquisition/ARCHITECTURE_MAP.md](../acquisition/ARCHITECTURE_MAP.md) | Acquisition-oriented map |
| [../acquisition/TECHNOLOGY_OVERVIEW.md](../acquisition/TECHNOLOGY_OVERVIEW.md) | Technology overview for diligence |

## Testing

```powershell
pnpm install
pnpm test
```

## Commercial

[../ACQUISITION.md](../ACQUISITION.md) · [acquisition/REPRODUCTION_COST.md](./acquisition/REPRODUCTION_COST.md)
