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

// A catalog reference can appear in any dependency field. Leaving one
// unresolved would make the install fail with an unsupported-URL error far
// from the cause, so every one of them is resolved or the script stops.
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
for (const field of DEPENDENCY_FIELDS) {
	const dependencies = manifest[field];
	if (!dependencies) {
		continue;
	}
	for (const [name, range] of Object.entries(dependencies)) {
		if (range !== "catalog:") {
			continue;
		}
		if (!(name in CATALOG)) {
			console.error(`catalog entry missing from the table in ${import.meta.filename}: ${name}`);
			process.exit(1);
		}
		dependencies[name] = CATALOG[name];
	}
}

manifest.name = PACKAGE;
manifest.repository = { type: "git", url: `git+${REPOSITORY}.git` };
delete manifest.repository.directory;
// The package page must not send readers to the upstream project's pages.
manifest.homepage = REPOSITORY;
manifest.bugs = { url: `${REPOSITORY}/issues` };

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
