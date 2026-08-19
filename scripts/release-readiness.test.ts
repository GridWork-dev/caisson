// Guards the required-check SET itself, not any one gate's logic. REQUIRED_CHECKS is a bare string
// list that release-readiness.ts compares against the GitHub check-runs API: a name here that no
// workflow defines makes every release "missing" that check forever, and a job here that carries a
// `paths:` filter reds readiness on every release whose diff happened not to touch it. Both
// failures are silent until a release is already in flight, which is the wrong time to find out.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { REQUIRED_CHECKS } from "./release-readiness.ts";

const WORKFLOWS_DIR = join(import.meta.dir, "..", ".github", "workflows");

/** Every workflow file, as { name, text }. Deliberately text, not parsed YAML: the two things
 *  asserted below (a top-level job key, and the presence of a `paths:` filter) are both reliably
 *  greppable, and the repo has no YAML parser dependency to reach for. */
function workflows(): { file: string; text: string }[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((file) => ({
      file,
      text: readFileSync(join(WORKFLOWS_DIR, file), "utf8"),
    }));
}

/** The file defining a job with this exact key under a top-level `jobs:` block, or null. Job keys
 *  sit at exactly two spaces of indent; the deploy/step names that share these words do not. */
function definingWorkflow(job: string): string | null {
  const key = new RegExp(
    `^ {2}${job.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`,
    "m",
  );
  return workflows().find((w) => key.test(w.text))?.file ?? null;
}

describe("REQUIRED_CHECKS — the release-readiness gate's own input", () => {
  test("the set is non-empty and has no duplicates", () => {
    // Guard the guard: an empty list would make every assertion below vacuously green.
    expect(REQUIRED_CHECKS.length).toBeGreaterThan(4);
    expect(new Set(REQUIRED_CHECKS).size).toBe(REQUIRED_CHECKS.length);
  });

  test("every required check is a job some workflow actually defines", () => {
    const undefinedChecks = REQUIRED_CHECKS.filter(
      (name) => definingWorkflow(name) === null,
    );
    expect(undefinedChecks).toEqual([]);
  });

  test("no required check is path-scoped — a skipped check never reports and reads as missing", () => {
    // ci.yml's header states the rule from the PR side (a path-skipped required job never reports
    // and the PR blocks forever); release-readiness.ts enforces it from the release side, where a
    // check with zero runs lands in `missing` and reds the gate. Same constraint, both directions.
    const pathScoped = REQUIRED_CHECKS.map((name) => ({
      name,
      file: definingWorkflow(name),
    }))
      .filter(({ file }) => file !== null)
      .filter(({ file }) => {
        const text = readFileSync(join(WORKFLOWS_DIR, file as string), "utf8");
        return /^\s{4}paths(-ignore)?:/m.test(text);
      })
      .map(({ name, file }) => `${name} (${file as string})`);
    expect(pathScoped).toEqual([]);
  });

  test("support-bot is in the set — ADR-0414 promoted it before automating its deploy", () => {
    // Pinned by name, not just by the structural rules above: the promotion is the whole reason
    // deploy-railway.yml is allowed to ship this service automatically. Dropping it back to
    // advisory silently restores "a red bot deploys anyway", which no structural check would catch.
    expect(REQUIRED_CHECKS).toContain("support-bot");
    expect(definingWorkflow("support-bot")).toBe("support-bot.yml");
  });
});
