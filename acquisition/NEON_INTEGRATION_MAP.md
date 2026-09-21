# Neon integration map

| Surface | Reprise relationship | Status |
| --- | --- | --- |
| Lakebase Postgres branches | Candidate isolation, branch list/create/delete | IMPLEMENTED / TESTED with mocked API contract |
| Database snapshots/PITR | Checkpoint database-state reference | PROPOSED |
| Functions | Function revision component reference | IMPLEMENTED as provider-neutral model; Neon adapter UNSUPPORTED |
| Object Storage | Contract component reference | IMPLEMENTED as provider-neutral model; Neon adapter UNSUPPORTED |
| Auth / Data API / AI Gateway | Configuration component references | IMPLEMENTED as provider-neutral model; Neon adapter UNSUPPORTED |
| Incident reconstruction | Graph/ledger/checkpoint reasoning | VERIFIED locally |
| Recovery Guard | Blocks stale or unverified promotion | VERIFIED locally |

No proposed capability should be understood as an existing Neon API integration.
