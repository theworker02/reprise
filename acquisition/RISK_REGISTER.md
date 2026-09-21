# Risk register

| Severity | Risk | Current mitigation | Release disposition |
| --- | --- | --- | --- |
| P1 | Live Neon branch adapter has not been tested with a real account | Mocked contract tests; documented endpoints only | Must validate before production claims |
| P1 | No authenticated ingestion or agent/MCP authorization | Surface is not exposed | Must implement before network deployment |
| P2 | Checkpoint repository is local JSON, not indexed/compacted | Integrity validation and atomic writes | Improve for multi-project scale |
| P2 | SHA-256 receipts are integrity hashes, not signer identity | Explicit documentation | Add keys/signatures |
| P2 | SBOM license classifications are not complete | CycloneDX artifact generated | Add license scanner/counsel review |
| P3 | GitHub Pages workflow has not run remotely | Static local site present | Configure Pages and validate deployment |

No P0 finding is known from local validation. P1 items block a production v1.1 release.
