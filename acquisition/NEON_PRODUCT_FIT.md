# Neon product fit

## Publicly documented Neon primitives

Neon documents Lakebase Postgres branches and backend primitives including Auth, Object Storage, Functions, Data API, and AI Gateway. Reprise treats those as provider-owned primitives and does not duplicate their storage or lifecycle APIs.

## What Reprise adds in this repository

- immutable state graph and append-only change ledger;
- compound checkpoint references across backend components;
- incident change-boundary reasoning that does not rely only on timestamps;
- compatibility-gated historical candidate reconstruction;
- verification receipts and a stale-plan Recovery Guard.

## Status boundary

The Neon adapter is not implemented. Any mapping of Reprise logic to live Neon branches, functions, buckets, Auth, Data API, or AI Gateway is proposed until an adapter is implemented and tested against documented interfaces.
