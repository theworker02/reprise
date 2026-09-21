# Technology overview

| Layer | Responsibility | Current state |
| --- | --- | --- |
| Core | Domain contracts, validation, checksums, redaction | Implemented and tested |
| Graph | Immutable typed dependency graph and impact traversal | Implemented and tested |
| Ledger | Hash-chained change events | Implemented and tested |
| Compatibility | Evidence-based compatible/incompatible/unknown evaluation | Implemented and tested |
| Recovery | Checkpoints, Time Machine, Guard, Signal, receipts | Implemented and tested locally |
| Provider SDK | Capability-gated provider contract | Implemented and tested |
| Neon adapter | Branch list/create/delete | Mocked contract-tested; no live-account validation |
| CLI/demo | Deterministic incident walkthrough | Implemented and tested |
| Website | Static explanatory and interactive fixture | Implemented; deployment workflow unrun |

No component silently upgrades `UNKNOWN` to compatible. Provider actions are separated from recovery planning.
