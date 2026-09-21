# Executive summary

Reprise is a recovery-reasoning layer for branchable backends. It does not replace a database platform’s branches, snapshots, or deployment tooling. It answers the operational question those primitives leave open: which historical combination of backend components is compatible, what evidence supports that conclusion, and can it be verified before production changes.

The technical core is executable: immutable state graph, hash-chained ledger, compatibility engine, deterministic checkpoint reconstruction, verification receipts, stale-plan guard, Reprise Signal, and a local incident demo. The repository is currently `1.1.0-rc.1`, not a production release.

For Neon, the implemented adapter uses documented Management API branch endpoints only. The strategic fit is complementary: Neon owns backend primitives; Reprise adds historical reasoning, incident reconstruction, and policy-controlled recovery evidence.
