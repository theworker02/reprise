# Changelog

All notable changes are documented in this file. Reprise follows semantic versioning; prerelease tags are not a claim of production general availability.

## [1.1.0-rc.3] - 2026-09-21

### Release summary

This release candidate adds an inspectable visual proof-of-concept surface to the deterministic acquisition fixture and completes the first pass of the Reprise identity system. The visual material is code-native, small, accessible, and explicit about the fact that it is a local simulation—not a recording of live provider recovery.

### Added

- Animated state-graph hero, four-step recovery briefing, interactive playback controls, and executable visual console in the static product site.
- A product-fit walkthrough explaining how Reprise’s compatibility and evidence layer can complement a branchable Postgres provider, with an explicit non-partnership disclaimer.
- `docs/PROOF_OF_CONCEPT.md`, including reproducible commands, expected fixture output, demonstrated behavior, and non-demonstrated boundaries.

### Changed

- Replaced the initial logo with an original return-path R monogram, high-contrast wordmark, dark lockup, and favicon-scale mark.
- Linked the proof-of-concept material from the README’s diligence references.

### Verification

- SVG identity assets pass XML parsing.
- `node --check website/app.js` and `pnpm build` pass.
- The full release validation suite is rerun before tagging and publishing this release.

### Important boundaries

- The visual demo is fixture-driven and makes no provider calls.
- No downloadable video, GIF, or binary artifact is included; the site uses inspectable HTML, CSS, JavaScript, and SVG.
- No live Neon recovery, snapshot/PITR operation, or production promotion is claimed or introduced.

## [1.1.0-rc.2] - 2026-09-21

### Release summary

This release candidate makes the v1.1 evaluation surface internally consistent and release-ready. It ships the validated Node 22 CI configuration, an expanded technical README, corrected capability wording, and detailed release documentation. It does not add a production restore executor or claim a live Neon validation.

### Changed

- Updated GitHub Actions and the declared runtime floor to Node 22.13+, matching pnpm 11.19.0’s `node:sqlite` requirement.
- Replaced the abbreviated README with a release-oriented guide covering implementation scope, architecture, safety behavior, setup, demo boundaries, Neon capabilities, validation, security, and diligence materials.
- Corrected the capability matrix to distinguish the implemented static interactive site from the proposed operational dashboard.
- Corrected public wording: repository access for evaluation does not make the proprietary code “unpublished.”

### Verification

- `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass locally.
- GitHub Actions CI passed the full release validation path: frozen install, build, lint, typecheck, test, acquisition demo, SBOM inventory, and CycloneDX output.

### Compatibility and safety

- No provider behavior, graph semantics, recovery policy, or receipt format changed.
- No production mutation command is introduced.
- The Neon adapter remains contract-tested only; live account validation remains outside this release.

## [1.1.0-rc.1] - 2026-09-21

### Added

- Reprise Signal: a signed recoverability posture with compatibility, evidence, verification, freshness, and unknowns reported independently.
- Durable local checkpoint persistence with integrity validation and atomic writes.
- Compound backend checkpoints, Time Machine reconstruction, change-boundary analysis, Recovery Guard, and tamper-evident recovery receipts.
- A capability-based Neon Management API adapter for documented branch discovery, creation, and explicit cleanup, covered by mocked provider contract tests.
- A credential-free deterministic acquisition scenario that reconstructs a v1.7 → v1.8 incompatible-function incident, verifies the v1.7 candidate, and emits a guarded receipt.
- Static product site assets, an interactive deterministic recovery scenario, GitHub Actions validation, GitHub Pages workflow, CycloneDX SBOM generation, and acquisition diligence material.

### Known boundaries

- The release candidate is not approved for general production use.
- The Neon adapter does not implement snapshot/PITR, schema diffs, Object Storage, Functions, Auth, Data API, or AI Gateway operations.
- Live provider verification and production promotion are intentionally not available.

## [Unreleased]

No unreleased product changes.
