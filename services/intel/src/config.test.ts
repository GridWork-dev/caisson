import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config.ts";

const BASE_ENV = {
  INTEL_DATABASE_URL: "postgres://user:pass@localhost:5432/intel",
};

describe("loadConfig", () => {
  test("fails closed without INTEL_DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow();
  });

  test("applies defaults when only the required var is set", () => {
    const config = loadConfig(BASE_ENV);
    expect(config.databaseUrl).toBe(BASE_ENV.INTEL_DATABASE_URL);
    expect(config.healthzPort).toBe(8791);
    // The scheduler is the daemon's default runner (ADR-0286 §5) — on unless explicitly disabled.
    expect(config.schedulerEnabled).toBe(true);
    // The LLM enrichment seam is the deliberate off-by-default path (SPEC "two-tier detection").
    expect(config.llmEnabled).toBe(false);
    expect(config.competitorUrls).toEqual([]);
    expect(config.githubOrg).toBe("caisson-sh");
  });

  test("parses a comma-separated competitor URL list, trimming entries", () => {
    const config = loadConfig({
      ...BASE_ENV,
      INTEL_COMPETITOR_URLS: "https://a.example.com, https://b.example.com ,,",
    });
    expect(config.competitorUrls).toEqual([
      "https://a.example.com",
      "https://b.example.com",
    ]);
  });

  test("boolFlag accepts common truthy/falsy spellings, case-insensitive", () => {
    // llmEnabled defaults false — prove the truthy spellings flip it on.
    for (const v of ["1", "true", "TRUE", "yes"]) {
      expect(loadConfig({ ...BASE_ENV, INTEL_LLM_ENABLED: v }).llmEnabled).toBe(
        true,
      );
    }
    // schedulerEnabled defaults true — prove the falsy spellings flip it off.
    for (const v of ["0", "false", "FALSE", "no"]) {
      expect(
        loadConfig({ ...BASE_ENV, INTEL_SCHEDULER_ENABLED: v })
          .schedulerEnabled,
      ).toBe(false);
    }
  });

  test("an unrecognized spelling falls back to the flag's own default rather than erroring", () => {
    expect(
      loadConfig({ ...BASE_ENV, INTEL_SCHEDULER_ENABLED: "maybe" })
        .schedulerEnabled,
    ).toBe(true);
    expect(
      loadConfig({ ...BASE_ENV, INTEL_LLM_ENABLED: "maybe" }).llmEnabled,
    ).toBe(false);
  });

  test("rejects an unparseable numeric cadence", () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, INTEL_CADENCE_COMPLIANCE_MS: "not-a-number" }),
    ).toThrow();
  });

  test("rejects an out-of-range quiet-hour", () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, INTEL_ALERT_QUIET_START: "24" }),
    ).toThrow();
  });
});
