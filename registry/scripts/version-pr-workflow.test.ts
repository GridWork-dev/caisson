import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const WORKFLOW = readFileSync(
  join(ROOT, ".github", "workflows", "version-pr.yml"),
  "utf8",
);
const refreshJob = WORKFLOW.slice(
  WORKFLOW.indexOf("  refresh-version-tarballs:"),
);

describe("version PR refresh candidate lock boundary (CAISSON-132)", () => {
  test("installs the candidate's frozen lockfile without lifecycle scripts before packing", () => {
    const candidateInstall =
      "working-directory: candidate\n        run: bun install --frozen-lockfile --ignore-scripts";
    const installAt = refreshJob.indexOf(candidateInstall);
    const packAt = refreshJob.indexOf(
      "bun trusted/registry/scripts/ci-publish-step.ts",
    );

    expect(installAt).toBeGreaterThan(-1);
    expect(packAt).toBeGreaterThan(installAt);
  });

  test("keeps refresh tooling execution on the trusted checkout", () => {
    expect(refreshJob).toContain(
      "bun trusted/registry/scripts/ci-publish-step.ts",
    );
    expect(refreshJob).not.toContain(
      "bun candidate/registry/scripts/ci-publish-step.ts",
    );
  });
});
