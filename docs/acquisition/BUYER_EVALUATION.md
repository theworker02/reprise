# Buyer evaluation â€” Reprise

## Goal

In 15â€“45 minutes, verify the Product builds or runs as documented and that proprietary notices are present.

## Steps

1. Confirm root `LICENSE` is proprietary and `ACQUISITION.md` exists.
2. Skim `README.md` install/run claims.
3. Execute:

```
```mermaid
flowchart TD
  F[Incident evidence] --> B[Change Boundary Engine]
  O[Normalized observations] --> L[Hash-chained Change Ledger]
  O --> G[Typed State Graph]
  L --> B
  G --> C[Compound checkpoint repository]
  B --> T[Time Machine]
  C --> T
  T --> V[Isolated verification]
  V --> RG[Recovery Guard]
  RG --> R[Tamper-evident receipt]
```
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
```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
node apps/cli/dist/index.js demo acquisition
```
```text
v1.7
â”œâ”€â”€ schema S12
â”œâ”€â”€ function F17
â””â”€â”€ storage contract C6

v1.8
```

4. Run tests if present (`npm test`, `pytest`, `cargo test`, `go test ./...`, etc.).
5. Record README vs observed behavior gaps in workpapers.

## Pass criteria

- [ ] Clone succeeds
- [ ] Documented happy path works **or** failure is explained
- [ ] Minimal path needs no surprise secrets
- [ ] License notices intact

*Updated: 2026-09-22*
