# Acquisition Brief â€” Reprise

**Date:** 2026-09-22  
**Repository:** https://github.com/theworker02/reprise  
**Default branch:** `main`  
**Primary language:** TypeScript  
**Status:** Diligence briefing only. **No acquisition has occurred** by virtue of this file.  
**License:** Proprietary â€” sale, written commercial license, or completed asset transfer required (see root `LICENSE`).  
**Valuation:** Not stated.  
**Contact:** GitHub [@theworker02](https://github.com/theworker02) Â· [thanks.dev/u/gh/theworker02](https://thanks.dev/u/gh/theworker02)

> Cloning or forking this repository does **not** grant production, redistribution, SaaS, OEM, or commercial rights.

---

## 1. Executive thesis

<img src="assets/logo.svg" width="260" alt="Reprise logo"> <p align="center"><strong>Recover the whole backend, not just the database.</strong></p> <a href="https://github.com/theworker02/reprise/releases"><img alt="Release candidate" src="https://img.shields.io/github/v/release/theworker02/reprise?display_name=tag&include_prereleases&sort=semver&label=release&color=4d7cff"></a>

**Why a buyer cares:** Reprise packages transferable product IP â€” source, docs, in-repo brand assets, and a diligence room under `docs/acquisition/` â€” under a clear proprietary posture so diligence can proceed without mistaking the repo for open source.

---

## 2. Product snapshot

| Item | Detail |
|------|--------|
| Product | Reprise |
| Repo | `theworker02/reprise` |
| Language | TypeScript |
| Open source? | **No** â€” proprietary |
| Rightsholder | theworker02 |
| Diligence pack | `docs/acquisition/` |

### Capability highlights (from current materials)

- [Why Reprise](#why-reprise)
- [What is implemented](#what-is-implemented)
- [Safety model](#safety-model)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Run the recovery demonstration](#run-the-recovery-demonstration)
- [Neon integration](#neon-integration)
- [Configuration and provider model](#configuration-and-provider-model)
- [Verification and auditability](#verification-and-auditability)
- [Repository layout](#repository-layout)
- [Development and validation](#development-and-validation)
- [Documentation and diligence](#documentation-and-diligence)

---

## 3. Problem / opportunity

Teams evaluating Reprise typically need either (a) a commercial right to run or embed it, or (b) outright ownership of the Product IP for strategic build-out. Public GitHub visibility without a proprietary license creates false assumptions about free production use. This brief and the linked data room make the commercial path explicit.

---

## 4. What ships today

Honest maturity: treat repository contents, README claims, tests, and release tags as the source of truth. Do not assume production customers, ARR, filed patents, or SLAs unless separately evidenced in diligence.

Typical transferable surfaces:

- Source tree and build/test scripts present in-repo
- Documentation and design notes
- Acquisition / diligence markdown under `docs/acquisition/`
- Branding assets committed to the repository (if any)

---

## 5. Demo / evaluation path (buyer)

Minimal path (no secrets required unless README says otherwise):

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

Extended evaluation: `docs/acquisition/BUYER_EVALUATION.md`. Written NDA / evaluation grants may be required for private materials.

---

## 6. What a transaction typically includes

Subject to definitive schedules:

| Included (typical) | Excluded (typical) |
|--------------------|--------------------|
| Repo materials + asserted original IP | Seller personal accounts / unrelated repos |
| Docs + diligence room at closing | Third-party dependency source under separate licenses |
| In-repo brand marks as assigned | Secrets without rotation plan |
| Know-how captured in docs | Fabricated revenue, user, or adoption metrics |

---

## 7. Suggested deal structures

| Structure | When it fits |
|-----------|--------------|
| Non-exclusive commercial license | Deploy/run under seat or environment terms |
| Exclusive field-of-use license | Buyer wants exclusivity; seller may retain entity |
| Asset / IP assignment | Buyer wants ownership of Materials outright |
| OEM / redistribution | Separate agreement â€” not implied here |

Commercial terms (price, earnouts, escrow) are negotiated under NDA with counsel.

---

## 8. Buyer diligence checklist

- [ ] Confirm Rightsholder identity and authority to sell/license
- [ ] Inventory Materials (`docs/acquisition/ASSET_INVENTORY.md`)
- [ ] Review IP posture (`IP_PROVENANCE.md`) and dependencies (`DEPENDENCY_INVENTORY.md`)
- [ ] Run evaluation script (`BUYER_EVALUATION.md`)
- [ ] Review risks (`RISK_REGISTER.md`)
- [ ] Agree transfer scope (`TRANSFER_MANIFEST.md`) and handoff (`HANDOFF_CHECKLIST.md`)
- [ ] Supersede root `LICENSE` at closing via definitive agreement

---

## 9. Related documents

| Document | Purpose |
|----------|---------|
| `LICENSE` | Proprietary â€” no default grant |
| `docs/acquisition/README.md` | Data-room index |
| `docs/acquisition/EXECUTIVE_SUMMARY.md` | One-page thesis |
| `README.md` | Product overview |
| `SECURITY.md` | Vulnerability reporting |
| `COMMERCIAL.md` | Licensing contact path |
| `.github/FUNDING.yml` | Sponsors / thanks.dev |

---

## 10. Disclaimer

This package is informational and **does not** create a binding offer, grant of rights, or investment advice. Engage counsel for any transaction.

---

*Document version: 2.0.0 / 2026-09-22 Â· Classification: acquisition briefing*
