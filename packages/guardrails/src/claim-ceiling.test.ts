// Unit tests for the claim-ceiling evaluator. Pure + deterministic — every fixture is a plain
// number tuple, no network/LLM call. Covers the three tiers, both boundaries (a lift landing
// exactly on `threshold` / `threshold + margin`), a regression, the degenerate margin=0 collapse,
// integer money-like inputs, and both `assertClaimAllowed`/`allowedClaims` entry points.
import { describe, expect, test } from "bun:test";
import {
  claimTier,
  assertClaimAllowed,
  allowedClaims,
  ClaimCeilingError,
  type Claim,
  type ClaimEvidence,
} from "./claim-ceiling.ts";

describe("claimTier", () => {
  test("lift short of threshold — unproven", () => {
    const evidence: ClaimEvidence = {
      metric: 0.1,
      baseline: 0.1,
      threshold: 0.05,
      margin: 0.05,
    };
    expect(claimTier(evidence)).toBe("unproven");
  });

  test("a regression (metric below baseline) is unproven even with threshold 0", () => {
    const evidence: ClaimEvidence = {
      metric: 90,
      baseline: 100,
      threshold: 0,
      margin: 10,
    };
    expect(claimTier(evidence)).toBe("unproven");
  });

  test("lift exactly at threshold — measured (inclusive boundary)", () => {
    const evidence: ClaimEvidence = {
      metric: 15,
      baseline: 10,
      threshold: 5,
      margin: 5,
    };
    expect(claimTier(evidence)).toBe("measured");
  });

  test("lift between threshold and threshold+margin — measured", () => {
    const evidence: ClaimEvidence = {
      metric: 17,
      baseline: 10,
      threshold: 5,
      margin: 5,
    };
    expect(claimTier(evidence)).toBe("measured");
  });

  test("lift exactly at threshold+margin — validated (inclusive boundary)", () => {
    const evidence: ClaimEvidence = {
      metric: 20,
      baseline: 10,
      threshold: 5,
      margin: 5,
    };
    expect(claimTier(evidence)).toBe("validated");
  });

  test("lift beyond threshold+margin — validated", () => {
    const evidence: ClaimEvidence = {
      metric: 40,
      baseline: 10,
      threshold: 5,
      margin: 5,
    };
    expect(claimTier(evidence)).toBe("validated");
  });

  test("margin=0 collapses the ladder — clearing threshold jumps straight to validated", () => {
    const evidence: ClaimEvidence = {
      metric: 5,
      baseline: 0,
      threshold: 5,
      margin: 0,
    };
    expect(claimTier(evidence)).toBe("validated");
  });

  test("threshold=0, margin=0, zero lift — validated (no improvement required to hold steady)", () => {
    const evidence: ClaimEvidence = {
      metric: 42,
      baseline: 42,
      threshold: 0,
      margin: 0,
    };
    expect(claimTier(evidence)).toBe("validated");
  });

  test("integer money-like units (cents) — exact boundary, no float drift", () => {
    // metric=10000c, baseline=9500c -> lift=500c; threshold=300c + margin=200c = 500c exactly.
    const evidence: ClaimEvidence = {
      metric: 10_000,
      baseline: 9_500,
      threshold: 300,
      margin: 200,
    };
    expect(claimTier(evidence)).toBe("validated");
    // one cent short of the margin boundary drops to measured.
    expect(claimTier({ ...evidence, metric: 9_999 })).toBe("measured");
  });
});

describe("assertClaimAllowed", () => {
  const strongEvidence: ClaimEvidence = {
    metric: 95,
    baseline: 80,
    threshold: 10,
    margin: 5,
  };
  // lift=12: clears threshold(10) but short of threshold+margin(15) -> "measured", not "validated".
  const weakEvidence: ClaimEvidence = {
    metric: 92,
    baseline: 80,
    threshold: 10,
    margin: 5,
  };

  test("does not throw when evidence meets the claim's minTier", () => {
    const claim: Claim = {
      text: "Cuts review time in half.",
      minTier: "validated",
    };
    expect(() => assertClaimAllowed(claim, strongEvidence)).not.toThrow();
  });

  test("does not throw when evidence EXCEEDS the claim's minTier (higher tier subsumes lower)", () => {
    const claim: Claim = { text: "Measurably faster.", minTier: "measured" };
    expect(() => assertClaimAllowed(claim, strongEvidence)).not.toThrow();
  });

  test("throws ClaimCeilingError when evidence falls short of the claim's minTier", () => {
    const claim: Claim = {
      text: "The fastest tool in its class.",
      minTier: "validated",
    };
    expect(() => assertClaimAllowed(claim, weakEvidence)).toThrow(
      ClaimCeilingError,
    );
  });

  test("thrown error carries claim text + both tiers in details, never a bare message-only error", () => {
    const claim: Claim = {
      text: "Industry-leading accuracy.",
      minTier: "validated",
    };
    try {
      assertClaimAllowed(claim, weakEvidence);
      throw new Error("expected assertClaimAllowed to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ClaimCeilingError);
      const e = err as ClaimCeilingError;
      expect(e.code).toBe("claim_ceiling_exceeded");
      expect(e.httpStatus).toBe(422);
      expect(e.details).toEqual({
        claimText: claim.text,
        requiredTier: "validated",
        achievedTier: "measured",
      });
    }
  });

  test("an unproven-evidence claim throws for any non-unproven minTier", () => {
    const claim: Claim = {
      text: "Now measurably better.",
      minTier: "measured",
    };
    const noEvidence: ClaimEvidence = {
      metric: 5,
      baseline: 10,
      threshold: 0,
      margin: 0,
    };
    expect(() => assertClaimAllowed(claim, noEvidence)).toThrow(
      ClaimCeilingError,
    );
  });
});

describe("allowedClaims", () => {
  const measuredClaim: Claim = {
    text: "We measured a real improvement.",
    minTier: "measured",
  };
  const validatedClaim: Claim = {
    text: "The most accurate option available.",
    minTier: "validated",
  };
  const unprovenClaim: Claim = {
    text: "We're actively working on this.",
    minTier: "unproven",
  };
  const claims: Claim[] = [measuredClaim, validatedClaim, unprovenClaim];

  test("unproven evidence only licenses the unproven-tier claim", () => {
    const evidence: ClaimEvidence = {
      metric: 1,
      baseline: 1,
      threshold: 5,
      margin: 5,
    };
    expect(allowedClaims(claims, evidence)).toEqual([unprovenClaim]);
  });

  test("measured evidence licenses measured + unproven claims, not validated", () => {
    const evidence: ClaimEvidence = {
      metric: 16,
      baseline: 10,
      threshold: 5,
      margin: 5,
    };
    expect(allowedClaims(claims, evidence)).toEqual([
      measuredClaim,
      unprovenClaim,
    ]);
  });

  test("validated evidence licenses every claim on the ladder", () => {
    const evidence: ClaimEvidence = {
      metric: 25,
      baseline: 10,
      threshold: 5,
      margin: 5,
    };
    expect(allowedClaims(claims, evidence)).toEqual(claims);
  });
});
