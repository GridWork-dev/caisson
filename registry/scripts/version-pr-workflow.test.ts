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
const consumeJob = WORKFLOW.slice(
  0,
  WORKFLOW.indexOf("  refresh-version-tarballs:"),
);

describe("version PR generator artifacts", () => {
  test("updates pins then regenerates the golden after consume and before packing", () => {
    const consumeAt = consumeJob.indexOf("run: bunx changeset version");
    const pinsAt = consumeJob.indexOf(
      "bun registry/scripts/sync-generator-template-pins.ts",
    );
    const goldenAt = consumeJob.indexOf(
      'BLESS=1 bun test ./src/generate.test.ts -t "framework=next composes the Next.js starter"',
    );
    const packAt = consumeJob.indexOf(
      "bun registry/scripts/ci-publish-step.ts",
    );
    expect(consumeAt).toBeGreaterThan(-1);
    expect(pinsAt).toBeGreaterThan(consumeAt);
    expect(goldenAt).toBeGreaterThan(pinsAt);
    expect(packAt).toBeGreaterThan(goldenAt);
    expect(refreshJob).not.toContain("sync-generator-template-pins");
    expect(refreshJob).not.toContain("BLESS=1");
  });

  test("stages the generated golden alongside template package manifests", () => {
    const stage = consumeJob.slice(
      consumeJob.indexOf("git add -A --"),
      consumeJob.indexOf("if git diff --cached --quiet"),
    );
    expect(stage).toContain("':(glob)**/package.json'");
    expect(stage).toContain(
      "packages/cli/src/__golden__/generated-fileset-framework-next.json",
    );
  });
});

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
