// src/campaign.test.ts — unit proof for the access-review boundary + the pure decision scan
// (ADR-0371). Schema cases run through `parseStrict` directly; the deps-untouched cases run the
// real kernel functions against throwing stubs, proving validation precedes every DB/chain touch
// — the same split @caisson-sh/compliance's impersonation kernel uses (session.test.ts). The
// DB-backed lifecycle (open/decide/close, deadline behavior, RLS) is proven in
// campaign.integration.test.ts.
import { describe, expect, test } from "bun:test";
import {
  ConflictError,
  ValidationError,
  parseStrict,
  type AuditChainEntry,
} from "@caisson-sh/kernel";
import {
  closeCampaignSchema,
  openCampaignSchema,
  recordDecisionSchema,
} from "./schema.ts";
import {
  closeCampaign,
  openCampaign,
  recordDecision,
  type CampaignDeps,
} from "./campaign.ts";
import {
  CAMPAIGN_DECISION_RECORD,
  evaluateCampaignClose,
  scanCampaignDecisions,
  type CampaignDecisionScan,
} from "./decisions.ts";

const ACCOUNT = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const CAMPAIGN = "1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function validOpenInput(): Record<string, unknown> {
  return {
    accountId: ACCOUNT,
    reviewerId: "reviewer-9",
    reviewees: ["user-1", "user-2"],
    deadlineMs: 7 * 24 * 60 * 60 * 1000,
  };
}

describe("openCampaignSchema — fail-closed boundary", () => {
  test("accepts a well-formed input", () => {
    expect(() =>
      parseStrict(openCampaignSchema, validOpenInput()),
    ).not.toThrow();
  });

  const rejected: Array<[string, Record<string, unknown>]> = [
    ["empty reviewees", { ...validOpenInput(), reviewees: [] }],
    [
      "duplicate reviewees",
      { ...validOpenInput(), reviewees: ["user-1", "user-1"] },
    ],
    ["deadlineMs 0", { ...validOpenInput(), deadlineMs: 0 }],
    ["negative deadlineMs", { ...validOpenInput(), deadlineMs: -1 }],
    ["non-integer deadlineMs", { ...validOpenInput(), deadlineMs: 1000.5 }],
    [
      "deadlineMs over the one-year ceiling",
      { ...validOpenInput(), deadlineMs: 366 * 24 * 60 * 60 * 1000 },
    ],
    ["non-uuid accountId", { ...validOpenInput(), accountId: "acct_a" }],
    ["empty reviewerId", { ...validOpenInput(), reviewerId: "" }],
    ["unknown extra field (.strict())", { ...validOpenInput(), role: "admin" }],
  ];
  for (const [name, input] of rejected) {
    test(`rejects ${name}`, () => {
      expect(() => parseStrict(openCampaignSchema, input)).toThrow(
        ValidationError,
      );
    });
  }
});

describe("recordDecisionSchema / closeCampaignSchema — fail-closed boundary", () => {
  test("recordDecisionSchema rejects an unknown decision value", () => {
    expect(() =>
      parseStrict(recordDecisionSchema, {
        accountId: ACCOUNT,
        campaignId: CAMPAIGN,
        revieweeId: "user-1",
        decision: "deny",
      }),
    ).toThrow(ValidationError);
  });

  test("closeCampaignSchema rejects an unknown extra field", () => {
    expect(() =>
      parseStrict(closeCampaignSchema, {
        accountId: ACCOUNT,
        campaignId: CAMPAIGN,
        force: true,
      }),
    ).toThrow(ValidationError);
  });
});

function throwingDeps(): CampaignDeps {
  return {
    db: {
      transaction: () => {
        throw new Error("db must not be touched before validation");
      },
    },
    chain: {
      append: () => {
        throw new Error("chain must not be touched before validation");
      },
      load: () => {
        throw new Error("chain must not be touched before validation");
      },
    },
  };
}

describe("validation precedes all I/O", () => {
  test("openCampaign never touches the DB or the chain on invalid input", async () => {
    await expect(
      openCampaign(throwingDeps(), {
        ...validOpenInput(),
        reviewees: [],
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  test("recordDecision never touches the DB or the chain on invalid input", async () => {
    await expect(
      recordDecision(throwingDeps(), {
        accountId: ACCOUNT,
        campaignId: CAMPAIGN,
        revieweeId: "user-1",
        decision: "deny",
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  test("closeCampaign never touches the DB or the chain on invalid input", async () => {
    await expect(
      closeCampaign(throwingDeps(), {
        accountId: "not-a-uuid",
        campaignId: CAMPAIGN,
      } as never),
    ).rejects.toThrow(ValidationError);
  });
});

function decisionEntry(
  seq: number,
  campaignId: string,
  revieweeId: string,
  decision: "approve" | "revoke",
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

describe("scanCampaignDecisions — pure, flag-never-guess", () => {
  test("takes the latest decision per reviewee and flags the rest unresolved", () => {
    const entries = [
      decisionEntry(0, CAMPAIGN, "alice", "approve"),
      decisionEntry(1, CAMPAIGN, "bob", "revoke"),
      decisionEntry(2, CAMPAIGN, "alice", "revoke"), // alice revises her decision
      decisionEntry(3, "some-other-campaign", "carol", "approve"), // must never bleed in
    ];
    const scan = scanCampaignDecisions(entries, CAMPAIGN, [
      "alice",
      "bob",
      "carol",
      "dave",
    ]);
    expect(scan.decisions.get("alice")).toBe("revoke");
    expect(scan.decisions.get("bob")).toBe("revoke");
    expect(scan.decisions.has("carol")).toBe(false);
    expect(scan.unresolved).toEqual(["carol", "dave"]);
  });

  test("an empty chain leaves every reviewee unresolved, never approved", () => {
    const scan = scanCampaignDecisions([], CAMPAIGN, ["alice", "bob"]);
    expect(scan.unresolved).toEqual(["alice", "bob"]);
    expect(scan.decisions.size).toBe(0);
  });

  test("a non-decision entry (e.g. campaign.opened) is ignored, not mis-parsed", () => {
    const entries: AuditChainEntry[] = [
      {
        seq: 0,
        prevHash: null,
        hash: "h0",
        payload: {
          kind: "access-review.campaign.opened",
          campaignId: CAMPAIGN,
        },
      },
    ];
    const scan = scanCampaignDecisions(entries, CAMPAIGN, ["alice"]);
    expect(scan.unresolved).toEqual(["alice"]);
  });
});

describe("evaluateCampaignClose — the extracted close guard closeCampaign throws through", () => {
  const complete: CampaignDecisionScan = {
    decisions: new Map(),
    unresolved: [],
  };
  const partial: CampaignDecisionScan = {
    decisions: new Map(),
    unresolved: ["alice", "bob"],
  };

  test("refuses while incomplete and not due, with the typed ConflictError", () => {
    const verdict = evaluateCampaignClose(partial, CAMPAIGN, false);
    if (verdict.outcome !== "refused") {
      throw new Error("expected a refusal");
    }
    expect(verdict.error).toBeInstanceOf(ConflictError);
    expect(verdict.error.code).toBe("conflict");
    expect(verdict.error.httpStatus).toBe(409);
    expect(verdict.error.details?.["campaignId"]).toBe(CAMPAIGN);
  });

  test("closes 'completed' when every reviewee decided", () => {
    expect(evaluateCampaignClose(complete, CAMPAIGN, false)).toEqual({
      outcome: "closed",
      reason: "completed",
      unresolved: [],
    });
  });

  test("closes 'deadline' with the undecided still listed, never approved", () => {
    expect(evaluateCampaignClose(partial, CAMPAIGN, true)).toEqual({
      outcome: "closed",
      reason: "deadline",
      unresolved: ["alice", "bob"],
    });
  });

  test("'completed' wins when the campaign is both complete and due", () => {
    const verdict = evaluateCampaignClose(complete, CAMPAIGN, true);
    expect(verdict.outcome === "closed" && verdict.reason).toBe("completed");
  });
});
