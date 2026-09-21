# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Send a concise report with reproduction details, impact, affected version, and a safe contact method to the repository maintainers through the private channel listed in the repository security settings. Do not include credentials, customer data, or provider tokens.

## Security posture

- Production mutation is disabled by default and no production restore CLI command is shipped.
- Recovery candidates are isolated conceptually through provider capabilities; unsupported provider operations fail closed.
- `UNKNOWN` compatibility blocks recovery under the default policy.
- The Recovery Guard rejects promotion when the state revision is stale or verification is absent.
- Checkpoints and recovery receipts are SHA-256 integrity protected; hash protection proves accidental or unsophisticated tampering, not signer identity.
- Configuration is validated at the boundary. Secrets must be passed through runtime secret stores or environment variables, never checkpoint metadata.

## Known boundary

This version does not implement webhook authentication, an MCP authorization layer, or a live provider adapter. Those surfaces must not be exposed publicly until their authentication and threat-model work is complete.
