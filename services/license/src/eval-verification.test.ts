// Pure verification-scoring tests (ADR-0280). No network, no DB — the fail-closed decision logic.
import { describe, expect, test } from "bun:test";
import {
  type DomainSignals,
  type EvalConfig,
  extractDomain,
  isDisposableDomain,
  isFreeMailDomain,
  loadEvalConfig,
  scoreApplication,
} from "./eval-verification.ts";

const CONFIG: EvalConfig = {
  windowDays: 14,
  applicationTtlDays: 7,
  globalActiveCap: 50,
  domainMinAgeDays: 90,
  autoApproveMaxRisk: 25,
  autoRejectMinRisk: 70,
};

// A domain the scorer treats as clearly good: MX present, well-established, enrichment low-risk.
const GOOD: DomainSignals = { mx: true, ageDays: 3650, enrichmentRisk: 5 };
const ALL_UNKNOWN: DomainSignals = {
  mx: undefined,
  ageDays: undefined,
  enrichmentRisk: undefined,
};

describe("extractDomain", () => {
  test("normalizes a valid work email to its lowercased domain", () => {
    expect(extractDomain("Alice@Example.COM")).toBe("example.com");
    expect(extractDomain("  bob@acme.io ")).toBe("acme.io");
  });
  test("rejects structurally invalid addresses", () => {
    for (const bad of [
      "no-at-sign",
      "a@b@c.com",
      "@example.com",
      "user@",
      "user@nodot",
      "user@.com",
      "a b@example.com",
    ]) {
      expect(extractDomain(bad)).toBeNull();
    }
  });
});

describe("free-mail + disposable classification", () => {
  test("known free-mail providers", () => {
    expect(isFreeMailDomain("gmail.com")).toBe(true);
    expect(isFreeMailDomain("acme.io")).toBe(false);
  });
  test("known disposable providers", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("acme.io")).toBe(false);
  });
});

describe("scoreApplication — hard pre-gate (fail-closed, no scoring)", () => {
  test("invalid email → auto_reject", () => {
    expect(scoreApplication("garbage", GOOD, CONFIG).decision).toBe(
      "auto_reject",
    );
  });
  test("free-mail domain → auto_reject even with otherwise-good signals", () => {
    const s = scoreApplication("dev@gmail.com", GOOD, CONFIG);
    expect(s.decision).toBe("auto_reject");
    expect(s.reason).toBe("free-mail-domain");
  });
  test("disposable domain → auto_reject", () => {
    expect(scoreApplication("x@mailinator.com", GOOD, CONFIG).reason).toBe(
      "disposable-domain",
    );
  });
  test("definitively no MX → auto_reject", () => {
    const s = scoreApplication(
      "dev@acme.io",
      { mx: false, ageDays: 3650, enrichmentRisk: 0 },
      CONFIG,
    );
    expect(s.decision).toBe("auto_reject");
    expect(s.reason).toBe("no-mx");
  });
});

describe("scoreApplication — risk bucketing", () => {
  test("established domain + MX + low enrichment → auto_approve", () => {
    const s = scoreApplication("dev@acme.io", GOOD, CONFIG);
    expect(s.decision).toBe("auto_approve");
  });

  test("NEVER auto_approve without positive evidence — all-unknown → review (fail-toward-manual)", () => {
    // 20 + 25 + 15 = 60: below the reject cutoff, above approve, no positive evidence → review.
    const s = scoreApplication("dev@acme.io", ALL_UNKNOWN, CONFIG);
    expect(s.decision).toBe("review");
  });

  test("realistic default (RDAP + enrichment off, MX present) → review, never auto-reject", () => {
    // The out-of-the-box path: only MX resolves; age + enrichment unknown. 0 + 25 + 15 = 40 → review.
    const s = scoreApplication(
      "dev@acme.io",
      { mx: true, ageDays: undefined, enrichmentRisk: undefined },
      CONFIG,
    );
    expect(s.decision).toBe("review");
  });

  test("enrichment unset alone widens an otherwise-good domain — still auto_approve when age is strong", () => {
    // MX + old domain, no enrichment: risk = RISK_ENRICHMENT_UNKNOWN (20) <= 25, positive evidence holds.
    const s = scoreApplication(
      "dev@acme.io",
      { mx: true, ageDays: 3650, enrichmentRisk: undefined },
      CONFIG,
    );
    expect(s.decision).toBe("auto_approve");
  });

  test("known-young domain never auto_approves (positive-evidence gate) → review", () => {
    // MX present, enrichment low, but the domain is younger than the min age.
    const s = scoreApplication(
      "dev@acme.io",
      { mx: true, ageDays: 10, enrichmentRisk: 5 },
      CONFIG,
    );
    expect(s.decision).toBe("review");
  });

  test("stacked uncertainty crosses the reject cutoff → auto_reject", () => {
    // mx unknown (25) + age young (35) + enrichment unknown (20) = 80 >= 70.
    const s = scoreApplication(
      "dev@acme.io",
      { mx: undefined, ageDays: 10, enrichmentRisk: undefined },
      CONFIG,
    );
    expect(s.decision).toBe("auto_reject");
    expect(s.risk).toBeGreaterThanOrEqual(CONFIG.autoRejectMinRisk);
  });

  test("high enrichment risk drives auto_reject", () => {
    const s = scoreApplication(
      "dev@acme.io",
      { mx: true, ageDays: 3650, enrichmentRisk: 100 },
      { ...CONFIG, autoRejectMinRisk: 45 },
    );
    expect(s.decision).toBe("auto_reject");
  });
});

describe("loadEvalConfig", () => {
  test("defaults with an empty env", () => {
    const c = loadEvalConfig({});
    expect(c.windowDays).toBe(14);
    expect(c.domainMinAgeDays).toBe(90);
    expect(c.autoApproveMaxRisk).toBeLessThan(c.autoRejectMinRisk);
  });
  test("reads + coerces env overrides", () => {
    const c = loadEvalConfig({
      EVAL_WINDOW_DAYS: "30",
      EVAL_GLOBAL_ACTIVE_CAP: "10",
    });
    expect(c.windowDays).toBe(30);
    expect(c.globalActiveCap).toBe(10);
  });
  test("fails closed when the approve/reject cutoffs cross (no review band)", () => {
    expect(() =>
      loadEvalConfig({
        EVAL_AUTO_APPROVE_MAX_RISK: "80",
        EVAL_AUTO_REJECT_MIN_RISK: "70",
      }),
    ).toThrow();
  });
  test("rejects a non-positive threshold", () => {
    expect(() => loadEvalConfig({ EVAL_WINDOW_DAYS: "0" })).toThrow();
  });
});
