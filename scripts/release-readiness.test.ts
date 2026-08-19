// Guards the required-check SET itself, not any one gate's logic. REQUIRED_CHECKS is a bare string
// list that release-readiness.ts compares against the GitHub check-runs API: a name here that no
// workflow defines makes every release "missing" that check forever, and a job here that can be
// skipped reds readiness on every release whose diff happened not to reach it. Both failures are
// silent until a release is already in flight, which is the wrong time to find out.
//
// Parsed with Bun.YAML, not regex. A first pass matched job KEYS with `^ {2}<name>:` and grepped
// for a 4-space `paths:`; the SHIP review defeated it three ways that this repo could plausibly
// produce — a `needs: changes` + `if: needs.changes.outputs.x` gate (quality.yml already has that
// `changes` job), a `paths:` at 6-space indent under a nested `on:`, and flow-style
// `push: { paths: [...] }`. A text heuristic over YAML is the wrong tool when a parser is in hand.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { REQUIRED_CHECKS } from "./release-readiness.ts";

const WORKFLOWS_DIR = join(import.meta.dir, "..", ".github", "workflows");

/** The ONE `if:` a required job may carry — the CAISSON-96 draft guard, per ci.yml's header. */
const DRAFT_GUARD =
  "github.event_name != 'pull_request' || github.event.pull_request.draft == false";

interface Job {
  name?: string;
  if?: string;
  needs?: string | string[];
}
interface Trigger {
  paths?: string[];
  "paths-ignore"?: string[];
}
interface Workflow {
  on?: Record<string, Trigger | null>;
  true?: Record<string, Trigger | null>; // YAML 1.1: a bare `on:` key parses as boolean true
  jobs?: Record<string, Job>;
}

interface Found {
  file: string;
  key: string;
  job: Job;
  triggers: Record<string, Trigger | null>;
}

/** Parse every workflow once, and index by the check-run NAME each job reports under — which is
 *  `name:` when present and the job key otherwise. release-readiness.ts matches on that reported
 *  name, so indexing by job key alone would go green while every release reported it missing. */
const unparsable: string[] = [];

function jobsByReportedName(): Map<string, Found> {
  const found = new Map<string, Found>();
  for (const file of readdirSync(WORKFLOWS_DIR).filter(
    (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
  )) {
    let wf: Workflow;
    try {
      wf = Bun.YAML.parse(
        readFileSync(join(WORKFLOWS_DIR, file), "utf8"),
      ) as Workflow;
    } catch (err) {
      // Collected, not thrown. A parse error at module scope takes the whole suite down as
      // "0 pass / 0 fail" — technically non-zero, but it reads as "no tests ran" rather than
      // "this workflow is malformed", and it hides every other check in this file.
      unparsable.push(`${file}: ${String(err)}`);
      continue;
    }
    const triggers = wf.on ?? wf.true ?? {};
    for (const [key, job] of Object.entries(wf.jobs ?? {})) {
      found.set(job.name ?? key, { file, key, job, triggers });
    }
  }
  return found;
}

describe("REQUIRED_CHECKS — the release-readiness gate's own input", () => {
  const byName = jobsByReportedName();

  test("every workflow file parses — a throw here would blank the whole suite", () => {
    expect(unparsable).toEqual([]);
  });

  test("the set is non-empty, deduplicated, and at full strength", () => {
    // Guard the guard: a floor below the real size lets one silently drop out.
    expect(REQUIRED_CHECKS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(REQUIRED_CHECKS).size).toBe(REQUIRED_CHECKS.length);
    // And the parse itself must have found something, or every check below is vacuous.
    expect(byName.size).toBeGreaterThan(10);
  });

  test("every required check is a job some workflow actually reports under that name", () => {
    expect(REQUIRED_CHECKS.filter((name) => !byName.has(name))).toEqual([]);
  });

  test("no required check is path-scoped — a skipped check never reports and reads as missing", () => {
    // ci.yml's header states the rule from the PR side (a path-skipped required job never reports
    // and the PR blocks forever); release-readiness.ts enforces it from the release side, where a
    // check with zero runs lands in `missing`. Same constraint, both directions.
    const scoped = REQUIRED_CHECKS.flatMap((name) => {
      const hit = byName.get(name);
      if (!hit) return [];
      return Object.entries(hit.triggers)
        .filter(([, t]) => t?.paths ?? t?.["paths-ignore"])
        .map(([event]) => `${name} (${hit.file}, on.${event})`);
    });
    expect(scoped).toEqual([]);
  });

  test("no required check is conditionally skippable — only the CAISSON-96 draft guard is allowed", () => {
    // The other way a required job silently stops reporting: a job-level `if:` or a `needs:` on a
    // path-filter job. quality.yml already has a `changes` job of exactly that shape, so this is a
    // pattern the repo can produce, not a hypothetical.
    const conditional = REQUIRED_CHECKS.flatMap((name) => {
      const hit = byName.get(name);
      if (!hit) return [];
      const reasons: string[] = [];
      if (hit.job.if !== undefined && hit.job.if.trim() !== DRAFT_GUARD) {
        reasons.push(`if: ${hit.job.if}`);
      }
      if (hit.job.needs !== undefined) {
        reasons.push(`needs: ${String(hit.job.needs)}`);
      }
      return reasons.map((r) => `${name} (${hit.file}) — ${r}`);
    });
    expect(conditional).toEqual([]);
  });

  test("support-bot is in the set — ADR-0414 promoted it before automating its deploy", () => {
    // Pinned by name, not just by the structural rules above: the promotion is the whole reason
    // deploy-railway.yml is allowed to ship this service automatically. Dropping it back to
    // advisory silently restores "a red bot deploys anyway", which no structural check would catch.
    expect(REQUIRED_CHECKS).toContain("support-bot");
    expect(byName.get("support-bot")?.file).toBe("support-bot.yml");
  });
});
