# Neon provider status

Reprise is designed to complement Neon’s documented branch-first backend primitives; it does not replace Neon storage or invent undocumented provider APIs.

## Current implementation

`@reprise/provider-neon` implements the documented Neon Management API branch endpoints:

- `GET /projects/{project_id}/branches` for discovery and health checks;
- `POST /projects/{project_id}/branches` for creating an isolated recovery branch; and
- `DELETE /projects/{project_id}/branches/{branch_id}` for explicit cleanup.

It requires a runtime-only `projectId` and API key. The token is never included in checkpoint, receipt, or log values. A project-scoped organization API key is the preferred minimum-scope credential where its documented permissions are sufficient.

## Not implemented

The adapter does not yet implement snapshot discovery/restore, point-in-time restore, schema diff, Object Storage, Functions, Auth, Data API, or AI Gateway operations. Missing capabilities are surfaced as unsupported, never simulated.

## Planned integration posture

When a live adapter is introduced it will use documented Neon interfaces, request least-privilege tokens, create an isolated branch by default, preserve `finalize_restore: false`, redact tokens, and record provider responses as checkpoint provenance.
