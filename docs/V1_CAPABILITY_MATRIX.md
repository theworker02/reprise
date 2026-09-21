# V1 capability matrix

| Capability | Status | Evidence |
| --- | --- | --- |
| Immutable state graph and dependency traversal | VERIFIED | Graph unit tests |
| Hash-chained change ledger | VERIFIED | Ledger tests |
| Evidence-based compatibility engine | VERIFIED | Compatibility tests |
| Compound backend checkpoints | VERIFIED | Recovery package tests |
| Deterministic checkpoint reconstruction | VERIFIED | Recovery and CLI tests |
| Change-boundary analysis | VERIFIED | Recovery and acquisition-demo tests |
| Stale-plan Recovery Guard | VERIFIED | Negative guard test |
| Tamper-evident recovery receipts | VERIFIED | Receipt integrity test |
| Credential-free acquisition demo | VERIFIED | CLI test |
| Neon branch lifecycle adapter | IMPLEMENTED / TESTED | Documented Management API branch endpoints, mocked contract tests |
| Neon snapshot/resource API adapter | UNSUPPORTED | No public API contract is claimed without adapter coverage |
| Production promotion executor | UNSUPPORTED | Deliberately absent from CLI |
| MCP agent server | PROPOSED | API design pending authorization model |
| Dashboard and GitHub Pages site | PROPOSED | Not yet implemented |
