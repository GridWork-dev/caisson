// The access-review poke's checkable claims, now that it drives the REAL @caisson-sh/access-review
// pure module (src/decisions.ts) and the hand-ported mirror (access-review-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill).
//      Critically, the walk must NOT reach campaign.ts (node:crypto + a VALUE import of
//      @caisson-sh/tenancy-rls) — the exact taint that forced the pure half into its own module.
//   2. The component really imports the pure module, not the package barrel — the barrel is
//      deliberately NOT browser-safe (campaign.ts + schedule.ts live on it), so the import
//      specifier itself is the guard.
//   3. The real scanCampaignDecisions / evaluateCampaignClose behave on the poke's own fixtures
//      exactly as closeCampaign's integration suite proves them server-side — one implementation,
//      no parity suite, nothing to drift.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ConflictError } from "@caisson-sh/kernel";

import {
  evaluateCampaignClose,
  scanCampaignDecisions,
} from "../../../../packages/access-review/src/decisions.ts";
import {
  SAMPLE_CAMPAIGN_ID,
  SAMPLE_REVIEWEES,
  decisionEntry,
} from "./access-review-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "access-review-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk reached the pure module and NEVER the db-bound half", () => {
    expect(walk.files).toContain("packages/access-review/src/decisions.ts");
    expect(walk.files).not.toContain("packages/access-review/src/campaign.ts");
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
  });

  test("positive control: the package's own barrel IS tainted — which is why the poke can't use it", () => {
    const barrel = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/access-review/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      barrel.offenders.some(
        (o) =>
          o.file === "packages/access-review/src/campaign.ts" &&
          o.spec === "node:crypto",
      ),
    ).toBe(true);
  });

  test("the component imports the pure module by its decisions path, never the barrel", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toContain("packages/access-review/src/decisions.ts");
    expect(src).not.toMatch(/from "@caisson-sh\/access-review"/);
  });
});

describe("the real decision scan on the poke's own fixtures", () => {
  test("latest decision per reviewee wins over an earlier one", () => {
    const [first, second] = SAMPLE_REVIEWEES;
    if (first === undefined || second === undefined) {
      throw new Error("sample roster too small");
    }
    const scan = scanCampaignDecisions(
      [
        decisionEntry(0, first, "approve"),
        decisionEntry(1, first, "revoke"),
        decisionEntry(2, second, "approve"),
      ],
      SAMPLE_CAMPAIGN_ID,
      SAMPLE_REVIEWEES,
    );
    expect(scan.decisions.get(first)).toBe("revoke");
    expect(scan.decisions.get(second)).toBe("approve");
    expect(scan.unresolved).toEqual(SAMPLE_REVIEWEES.slice(2));
  });

  test("an empty log leaves every reviewee unresolved and never approved", () => {
    const scan = scanCampaignDecisions(
      [],
      SAMPLE_CAMPAIGN_ID,
      SAMPLE_REVIEWEES,
    );
    expect(scan.decisions.size).toBe(0);
    expect(scan.unresolved).toEqual([...SAMPLE_REVIEWEES]);
  });

  test("a decision carrying a foreign campaignId never bleeds in", () => {
    const first = SAMPLE_REVIEWEES[0];
    if (first === undefined) throw new Error("sample roster empty");
    const foreign = {
      ...decisionEntry(0, first, "approve"),
      payload: {
        kind: "access-review.decision",
        campaignId: "00000000-0000-4000-8000-000000000000",
        revieweeId: first,
        decision: "approve",
      },
    };
    const scan = scanCampaignDecisions(
      [foreign],
      SAMPLE_CAMPAIGN_ID,
      SAMPLE_REVIEWEES,
    );
    expect(scan.decisions.size).toBe(0);
    expect(scan.unresolved).toContain(first);
  });
});

describe("the real close guard on the poke's own fixtures", () => {
  function scanOf(decided: number) {
    return scanCampaignDecisions(
      SAMPLE_REVIEWEES.slice(0, decided).map((r, i) =>
        decisionEntry(i, r, "approve"),
      ),
      SAMPLE_CAMPAIGN_ID,
      SAMPLE_REVIEWEES,
    );
  }

  test("refuses while incomplete and not due, with the real ConflictError", () => {
    const verdict = evaluateCampaignClose(scanOf(2), SAMPLE_CAMPAIGN_ID, false);
    if (verdict.outcome !== "refused") throw new Error("expected a refusal");
    expect(verdict.error).toBeInstanceOf(ConflictError);
    expect(verdict.error.code).toBe("conflict");
    expect(verdict.error.httpStatus).toBe(409);
    expect(verdict.error.details?.["campaignId"]).toBe(SAMPLE_CAMPAIGN_ID);
  });

  test("a due close reports the undecided in unresolved rather than approving them", () => {
    const verdict = evaluateCampaignClose(scanOf(2), SAMPLE_CAMPAIGN_ID, true);
    if (verdict.outcome !== "closed") throw new Error("expected a close");
    expect(verdict.reason).toBe("deadline");
    expect(verdict.unresolved).toEqual(SAMPLE_REVIEWEES.slice(2));
  });

  test("a complete close reports reason 'completed', and completed wins over deadline", () => {
    const all = SAMPLE_REVIEWEES.length;
    const notDue = evaluateCampaignClose(
      scanOf(all),
      SAMPLE_CAMPAIGN_ID,
      false,
    );
    const due = evaluateCampaignClose(scanOf(all), SAMPLE_CAMPAIGN_ID, true);
    expect(notDue.outcome === "closed" && notDue.reason).toBe("completed");
    expect(due.outcome === "closed" && due.reason).toBe("completed");
  });
});
