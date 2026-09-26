// scripts/gen-catalog-for-ci.ts — CI-only fixture generator for the `oscal-conformance` job's
// catalog-validation leg (SPEC outputs/specs/oscal-spine, task 2). Writes the merged caisson OSCAL
// catalog (`toOscalCatalog`, already unit- and golden-tested in
// src/evidence/oscal-catalog-export.test.ts) to the given path, so the CI job can hand it straight
// to `oscal-cli validate`. Deterministic (fixed clock + id sequence) so a CI failure reproduces
// identically on a local re-run.
//
// Usage: bun packages/frameworks-pack/scripts/gen-catalog-for-ci.ts <output-path>
import { writeFileSync } from "node:fs";
import { euAiAct, hipaaSecurity, soc2Tsc } from "@caisson-sh/frameworks-pack";
import { toOscalCatalog } from "@caisson-sh/oscal-spine";

function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function main(): void {
  const outPath = process.argv[2];
  if (outPath === undefined || outPath.length === 0) {
    process.stderr.write(
      "gen-catalog-for-ci: usage: bun scripts/gen-catalog-for-ci.ts <output-path>\n",
    );
    process.exitCode = 1;
    return;
  }
  const doc = toOscalCatalog([soc2Tsc, hipaaSecurity, euAiAct], {
    now: new Date("2026-01-01T00:00:00.000Z"),
    newId: counterIds(),
    title: "Caisson Canonical Control Catalog",
    version: "2026.1",
  });
  writeFileSync(outPath, JSON.stringify(doc, null, 2));
  process.stdout.write(`gen-catalog-for-ci: wrote ${outPath}\n`);
}

if (import.meta.main) main();
