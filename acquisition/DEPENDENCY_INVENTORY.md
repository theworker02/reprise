# Dependency inventory

The authoritative dependency inventory is [SBOM.cyclonedx.json](SBOM.cyclonedx.json), generated from the locked workspace with pnpm’s CycloneDX command. `SBOM.json` is a supplemental direct-manifest inventory.

Primary runtime dependencies are deliberately small: `yaml` and `zod` in core. TypeScript, Vitest, Node typings, and rimraf are development dependencies. No provider SDK is bundled; the Neon adapter uses the platform’s documented HTTP API through the native runtime `fetch`.
