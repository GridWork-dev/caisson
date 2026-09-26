/**
 * Generate the agent-readable @caisson-sh/ui component manifest from the authoritative component
 * barrel, exported prop types, co-located CSS, and component JSDoc.
 *
 * Run:
 *   bun run gen:manifest
 *   bun run check:manifest
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertManifestCurrent,
  buildComponentManifest,
  renderComponentManifest,
} from "./manifest-generator.ts";

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(uiRoot, "../ds-manifest/src/base-manifest.json");
const generated = renderComponentManifest(buildComponentManifest(uiRoot));
const args = new Set(process.argv.slice(2));
const allowed = new Set(["--check"]);

for (const arg of args) {
  if (!allowed.has(arg)) throw new Error(`unknown argument: ${arg}`);
}

if (args.has("--check")) {
  assertManifestCurrent(readFileSync(outputPath, "utf8"), generated);
  process.stdout.write(`component manifest current: ${outputPath}\n`);
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, generated, "utf8");
  process.stdout.write(`wrote ${outputPath}\n`);
}
