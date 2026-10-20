#!/usr/bin/env node
// Patch the upstream package.json after every sync from the monorepo.
//
// The upstream package lives inside the gotgenes monorepo, so its manifest
// assumes things this repository does not have: pnpm workspace catalogs, a
// base tsconfig one directory up, an eslint config at the monorepo root, and
// the upstream scope in the package name. This script rewrites the manifest
// so the package builds and publishes on its own.
//
// The catalog table below is the only place the monorepo's versions are
// recorded. When upstream moves a catalog entry the script fails loudly
// rather than publishing a package with an unresolved "catalog:" version.
//
//   node pd/fixup.mjs
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "package.json";
const PACKAGE = "@xprnvd/pi-permission-system";
const REPOSITORY = "https://github.com/xprnvd/pi-permission-system";

// The monorepo's pnpm-workspace.yaml catalog, resolved to concrete versions.
const CATALOG = {
	"@biomejs/biome": "^2.5.11",
	"@types/node": "^22.15.3",
	rollup: "^4.63.1",
	"rollup-plugin-dts": "^6.5.1",
	rumdl: "0.2.24",
	typescript: "^6.0.3",
	vitest: "^4.1.11",
};

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

const unresolved = Object.entries(manifest.devDependencies ?? {}).filter(([, range]) => range === "catalog:");
const unknown = unresolved.map(([name]) => name).filter((name) => !(name in CATALOG));
if (unknown.length > 0) {
	console.error(`catalog entries missing from the table in ${import.meta.filename}: ${unknown.join(", ")}`);
	process.exit(1);
}
for (const [name] of unresolved) {
	manifest.devDependencies[name] = CATALOG[name];
}

manifest.name = PACKAGE;
manifest.repository = { type: "git", url: `git+${REPOSITORY}.git` };
delete manifest.repository.directory;

// pnpm workspace scripts become npm scripts.
if (manifest.scripts?.prepack === "pnpm run build:types") {
	manifest.scripts.prepack = "npm run build:types";
}
// The eslint pass ran against the monorepo root's config, which is scoped to
// packages/*/src and packages/*/test paths that do not exist here. Biome and
// rumdl cover this package on their own.
manifest.scripts.lint = "biome check . && npm run lint:md";

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`patched ${MANIFEST} for ${PACKAGE}`);
