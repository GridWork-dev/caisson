// Unit tests for the FTC "4 Ps" dark-pattern presentation guardrail (ADR-0215). Pure + deterministic
// — every fixture is a synthetic copy snippet, no network/LLM call. One scareware fixture per rule
// (proves the right dimension + rule id fires), one clean-copy pass, and one fixture where the
// disclosure sits correctly nearby (proving the window check suppresses the finding, not just fires
// on any trigger word).
import { describe, expect, test } from "bun:test";
import { evaluateFtc4P, ftc4pModerator } from "./ftc4p.ts";

describe("evaluateFtc4P — one scareware fixture per rule", () => {
  test("false-urgency — a scarcity claim with no real deadline", () => {
    const result = evaluateFtc4P(
      "Hurry! Only 3 left in stock — act now before it's gone!",
    );
    expect(result.flagged).toBe(true);
    expect(
      result.findings.some(
        (f) => f.rule === "false-urgency" && f.dimension === "prominence",
      ),
    ).toBe(true);
  });

  test("forced-continuity — a free trial with no cancel/price-after disclosure", () => {
    const result = evaluateFtc4P(
      "Start your free trial today and unlock everything instantly!",
    );
    expect(result.flagged).toBe(true);
    expect(
      result.findings.some(
        (f) => f.rule === "forced-continuity" && f.dimension === "proximity",
      ),
    ).toBe(true);
  });

  test("confirmshaming — guilt-framed decline copy", () => {
    const result = evaluateFtc4P(
      "No, I don't want to save money on this deal.",
    );
    expect(result.flagged).toBe(true);
    expect(
      result.findings.some(
        (f) => f.rule === "confirmshaming" && f.dimension === "presentation",
      ),
    ).toBe(true);
  });

  test("opt-out-enrollment — enrollment defaulted to on, opt-out framed", () => {
    const result = evaluateFtc4P(
      "You'll be automatically enrolled in our premium plan unless you uncheck this box.",
    );
    expect(result.flagged).toBe(true);
    expect(
      result.findings.some(
        (f) => f.rule === "opt-out-enrollment" && f.dimension === "placement",
      ),
    ).toBe(true);
  });

  test("drip-pricing — a headline price with no fee qualifier nearby", () => {
    const result = evaluateFtc4P(
      "Get started for just $9.99 and unlock the full toolkit.",
    );
    expect(result.flagged).toBe(true);
    expect(
      result.findings.some(
        (f) => f.rule === "drip-pricing" && f.dimension === "proximity",
      ),
    ).toBe(true);
  });
});

describe("evaluateFtc4P — clean copy", () => {
  test("ordinary copy with no dark-pattern language passes", () => {
    const result = evaluateFtc4P(
      "This starter kit ships as a composable base plus optional feature packs; add what you need, anytime.",
    );
    expect(result.flagged).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.scores).toEqual({
      prominence: 1,
      presentation: 1,
      placement: 1,
      proximity: 1,
    });
  });
});

describe("evaluateFtc4P — disclosure correctly adjacent", () => {
  test("a deadline claim WITH a real nearby date/time raises no finding", () => {
    const result = evaluateFtc4P(
      "Offer ends today at 11:59pm ET — get it before the clock runs out.",
    );
    expect(result.flagged).toBe(false);
    expect(result.findings).toHaveLength(0);
  });
});

describe("ftc4pModerator", () => {
  test("wraps evaluateFtc4P as a Moderator flagging category 'custom'", async () => {
    const mod = ftc4pModerator();
    const flagged = await mod.moderate(
      "Hurry! Only 3 left in stock — act now before it's gone!",
    );
    expect(flagged).toEqual({ flagged: true, category: "custom" });
    const clean = await mod.moderate("A plain, honest product description.");
    expect(clean).toEqual({ flagged: false, category: "custom" });
  });
});
