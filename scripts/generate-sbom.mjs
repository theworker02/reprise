import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const lockPath = resolve(root, "pnpm-lock.yaml");
const outPath = resolve(root, "acquisition", "SBOM.json");
if (!existsSync(lockPath)) throw new Error("pnpm-lock.yaml is required to generate the SBOM");

// This intentionally conservative inventory records direct workspace manifests.
// A package-manager-native CycloneDX generator can replace it at release time.
const packages = [];
for (const importer of ["package.json", ...["apps/cli", "packages/core", "packages/graph", "packages/ledger", "packages/policy", "packages/providers", "packages/recovery", "packages/sdk", "packages/telemetry", "packages/verifier", "packages/compatibility", "packages/planner", "providers/neon"].map((dir) => `${dir}/package.json`)]) {
  const file = resolve(root, importer);
  if (!existsSync(file)) continue;
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  packages.push({ name: manifest.name, version: manifest.version, license: manifest.license ?? "UNKNOWN", path: importer, dependencies: Object.keys({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }).sort() });
}
const sbom = { bomFormat: "Reprise-inventory", specVersion: "0.1", generatedAt: new Date().toISOString(), source: "package manifests; not a substitute for a release CycloneDX/SPDX scan", packages };
if (process.argv.includes("--check")) {
  if (!existsSync(outPath)) throw new Error("acquisition/SBOM.json is missing; run node scripts/generate-sbom.mjs");
  process.exit(0);
}
writeFileSync(outPath, `${JSON.stringify(sbom, null, 2)}\n`);
