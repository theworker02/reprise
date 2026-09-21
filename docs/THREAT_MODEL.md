# Threat model

## Assets

Recovery evidence, checkpoint references, provider credentials, backend revisions, verification results, and production safety boundaries are security-sensitive.

## Primary threats and mitigations

| Threat | Current mitigation | Remaining work |
| --- | --- | --- |
| Stale recovery plan promotes against new state | Recovery Guard compares state revisions | Live provider read-before-promote adapter |
| Unknown compatibility treated as safe | Default policy blocks unknowns | Cross-provider signal collection |
| Tampered receipt/checkpoint | Deterministic SHA-256 integrity hashes | Keyed signatures and key management |
| Secret leakage through telemetry | Structured redaction exists | Secret scanning and provider adapter review |
| Unsafe destructive provider action | No production mutation command; provider capability gate | Scoped live authorization |
| Spoofed webhook/agent request | Not exposed in this release | Signed webhook and MCP auth design |
