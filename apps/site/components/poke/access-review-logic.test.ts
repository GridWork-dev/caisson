// Real-package parity for the access-review poke's browser mirror (access-review-logic.ts). Two
// independent anchors: (1) the real `scanCampaignDecisions`, imported here by relative path
// (apps/site does not declare @caisson/access-review as a workspace dependency — see
// access-review-logic.ts's header for why), and (2) the real `ConflictError` class from
// `@caisson/kernel` (already a declared apps/site dependency), whose `.code`/`.httpStatus` pin the
// mirror's `ConflictErrorLike` shape. Bun's test runtime is node-like, so campaign.ts's
// node:crypto / @caisson/tenancy-rls imports resolve fine here even though they cannot reach a
// browser bundle. This package ships no `__golden__` fixture dir (checked: none exists) — parity
// against the real functions is the golden anchor.
import { describe, expect, test } from "bun:test";
import { ConflictError } from "@caisson/kernel";

import { scanCampaignDecisions as pkgScanCampaignDecisions } from "../../../../packages/access-review/src/campaign.ts";
import type { AuditChainEntry } from "../../../../packages/kernel/src/canonical.ts";

import {
  CAMPAIGN_DECISION_RECORD,
  REVIEW_DECISIONS,
  evaluateClose,
  scanCampaignDecisions,
  type DecisionChainEntry,
  type ReviewDecision,
} from "./access-review-logic";

const CAMPAIGN = "1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function decisionEntry(
  seq: number,
  campaignId: string,
  revieweeId: string,
  decision: ReviewDecision,
): AuditChainEntry {
  return {
    seq,
    prevHash: seq === 0 ? null : `h${seq - 1}`,
    hash: `h${seq}`,
    payload: {
      kind: CAMPAIGN_DECISION_RECORD,
      campaignId,
      revieweeId,
      decision,
    },
  };
}

// Full AuditChainEntry fixtures (seq + prevHash + hash + payload) — structurally assignable to
// this mirror's narrower DecisionChainEntry (seq + payload), exactly as the header documents.
const SAMPLE_ENTRIES: readonly AuditChainEntry[] = [
  decisionEntry(0, CAMPAIGN, "alice", "approve"),
  decisionEntry(1, CAMPAIGN, "bob", "revoke"),
  decisionEntry(2, CAMPAIGN, "alice", "revoke"), // alice revises her decision
  decisionEntry(3, "some-other-campaign", "carol", "approve"), // must never bleed in
];
const ROSTER = ["alice", "bob", "carol", "dave"] as const;

describe("scanCampaignDecisions — real-package parity", () => {
  test("matches the real package's scanCampaignDecisions on the same entries", () => {
    const mine = scanCampaignDecisions(SAMPLE_ENTRIES, CAMPAIGN, ROSTER);
    const real = pkgScanCampaignDecisions(SAMPLE_ENTRIES, CAMPAIGN, ROSTER);
    expect([...mine.decisions.entries()]).toEqual([
      ...real.decisions.entries(),
    ]);
    expect(mine.unresolved).toEqual(real.unresolved);
  });

  test("takes the latest decision per reviewee and flags the rest unresolved", () => {
    const scan = scanCampaignDecisions(SAMPLE_ENTRIES, CAMPAIGN, ROSTER);
    expect(scan.decisions.get("alice")).toBe("revoke");
    expect(scan.decisions.get("bob")).toBe("revoke");
    expect(scan.decisions.has("carol")).toBe(false);
    expect(scan.unresolved).toEqual(["carol", "dave"]);
  });

  test("an empty chain leaves every reviewee unresolved, never approved (mine and real agree)", () => {
    const roster = ["alice", "bob"] as const;
    expect(scanCampaignDecisions([], CAMPAIGN, roster).unresolved).toEqual([
      "alice",
      "bob",
    ]);
    expect(pkgScanCampaignDecisions([], CAMPAIGN, roster).unresolved).toEqual([
      "alice",
      "bob",
    ]);
  });

  test("a non-decision entry (e.g. campaign.opened) is ignored, not mis-parsed", () => {
    const entries: DecisionChainEntry[] = [
      {
        seq: 0,
        payload: {
          kind: "access-review.campaign.opened",
          campaignId: CAMPAIGN,
        },
      },
    ];
    const scan = scanCampaignDecisions(entries, CAMPAIGN, ["alice"]);
    expect(scan.unresolved).toEqual(["alice"]);
  });

  test("REVIEW_DECISIONS carries exactly the two decision values the package defines", () => {
    expect(REVIEW_DECISIONS).toEqual(["approve", "revoke"]);
  });
});

describe("evaluateClose — mirrors closeCampaign's guard (never a partial/forced close)", () => {
  test("refuses when neither complete nor due (the break-it path)", () => {
    const scan = scanCampaignDecisions(
      [decisionEntry(0, CAMPAIGN, "alice", "approve")],
      CAMPAIGN,
      ["alice", "bob"],
    );
    const verdict = evaluateClose(scan, CAMPAIGN, false);
    expect(verdict).toMatchObject({
      outcome: "refused",
      error: { code: "conflict", httpStatus: 409 },
    });
  });

  test("the refusal's shape matches the real ConflictError class", () => {
    const scan = scanCampaignDecisions([], CAMPAIGN, ["alice"]);
    const verdict = evaluateClose(scan, CAMPAIGN, false);
    if (verdict.outcome !== "refused") throw new Error("expected a refusal");
    const real = new ConflictError(verdict.error.message, {
      campaignId: CAMPAIGN,
    });
    expect(verdict.error.code).toBe(real.code);
    expect(verdict.error.httpStatus).toBe(real.httpStatus);
    expect(verdict.error.message).toBe(
      "access-review campaign is neither complete nor past its deadline",
    );
  });

  test("closes complete, never forced, when every reviewee has decided", () => {
    const scan = scanCampaignDecisions(
      [
        decisionEntry(0, CAMPAIGN, "alice", "approve"),
        decisionEntry(1, CAMPAIGN, "bob", "revoke"),
      ],
      CAMPAIGN,
      ["alice", "bob"],
    );
    const verdict = evaluateClose(scan, CAMPAIGN, false);
    expect(verdict).toEqual({
      outcome: "closed",
      reason: "completed",
      unresolved: [],
    });
  });

  test("closes past the deadline with the undecided flagged unresolved, never auto-approved", () => {
    const scan = scanCampaignDecisions(
      [decisionEntry(0, CAMPAIGN, "alice", "approve")],
      CAMPAIGN,
      ["alice", "bob"],
    );
    const verdict = evaluateClose(scan, CAMPAIGN, true);
    expect(verdict).toEqual({
      outcome: "closed",
      reason: "deadline",
      unresolved: ["bob"],
    });
  });

  test("completion wins over isDue in the reported reason when both hold", () => {
    const scan = scanCampaignDecisions(
      [decisionEntry(0, CAMPAIGN, "alice", "approve")],
      CAMPAIGN,
      ["alice"],
    );
    const verdict = evaluateClose(scan, CAMPAIGN, true);
    expect(verdict).toEqual({
      outcome: "closed",
      reason: "completed",
      unresolved: [],
    });
  });
});
