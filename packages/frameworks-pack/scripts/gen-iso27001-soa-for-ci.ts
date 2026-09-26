// scripts/gen-iso27001-soa-for-ci.ts — CI-only fixture generator for the `oscal-conformance` job's
// ISO/IEC 27001:2022 Statement-of-Applicability leg (mirrors `gen-catalog-for-ci.ts`). Writes the
// OSCAL `component-definition` SoA export (`toOscalIso27001Soa`, already unit- and golden-tested in
// `src/evidence/oscal-iso27001-soa.test.ts`) to the given path, so the CI job can hand it straight to
// `oscal-cli validate`. Deterministic (fixed clock + id sequence) so a CI failure reproduces
// identically on a local re-run.
//
// Usage: bun packages/frameworks-pack/scripts/gen-iso27001-soa-for-ci.ts <output-path>
import { writeFileSync } from "node:fs";
import {
  computeIso27001SoaRows,
  iso27001Crosswalk,
  type ControlEvidenceStatus,
} from "@caisson-sh/frameworks-pack";
import { toOscalIso27001Soa } from "@caisson-sh/oscal-spine";

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
      "gen-iso27001-soa-for-ci: usage: bun scripts/gen-iso27001-soa-for-ci.ts <output-path>\n",
    );
    process.exitCode = 1;
    return;
  }

  // Every control the shipped crosswalk covers, all marked "ready", PLUS one out-of-scope control
  // (A.9.99, not a real Annex A id) — a representative CI smoke fixture, not a real tenant's
  // evidence run (a real run supplies its own scope + statuses). The extra id is WR-03: without it
  // the unresolved-requirement shape (no crosswalk row -> applicable: "unresolved") never reaches
  // the schema-validated CI fixture, so a shape regression there would go undetected.
  const controlStatuses = new Map<string, ControlEvidenceStatus>(
    iso27001Crosswalk.rows
      .filter((row) => row.canonicalControlId !== undefined)
      .map((row) => [row.canonicalControlId as string, "ready" as const]),
  );
  const rows = computeIso27001SoaRows({
    controlIds: [...iso27001Crosswalk.rows.map((row) => row.control), "A.9.99"],
    crosswalk: iso27001Crosswalk,
    controlStatuses,
  });

  const doc = toOscalIso27001Soa(rows, {
    now: new Date("2026-01-01T00:00:00.000Z"),
    newId: counterIds(),
    title: "Caisson ISO/IEC 27001:2022 Statement of Applicability",
    version: iso27001Crosswalk.crosswalkVersion,
  });
  writeFileSync(outPath, JSON.stringify(doc, null, 2));
  process.stdout.write(`gen-iso27001-soa-for-ci: wrote ${outPath}\n`);
}

if (import.meta.main) main();
