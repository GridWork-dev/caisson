import { describe, expect, test } from "bun:test";
import { buildEnrichPrompt, enrichFindings } from "./llm.ts";
import type { Fetcher } from "./http.ts";
import type { Config } from "./config.ts";
import type { Finding } from "./finding.ts";

const finding: Finding = {
  source: "compliance",
  kind: "framework_release",
  severity: "info",
  title: "NIST OSCAL released v2.0.0",
  body: "OSCAL moved from v1.0.0 to v2.0.0.",
  dedupKey: "compliance:oscal:v2-0-0",
  payload: {},
};

const baseConfig: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "0.0.0.0",
  schedulerEnabled: false,
  migrateOnBoot: false,
  cadenceComplianceMs: 1,
  cadenceSoc2Ms: 1,
  cadenceCompetitorMs: 1,
  cadenceGithubMs: 1,
  cadenceAnalyticsMs: 1,
  cadenceErrorMs: 1,
  competitorUrls: [],
  githubOrg: "caisson-sh",
  posthogApiHost: "https://us.posthog.com",
  posthogProjectId: "493539",
  plausibleApiHost: "https://plausible.io",
  alertRateMaxPerWindow: 3,
  alertTz: "UTC",
  alertQuietStart: 0,
  alertQuietEnd: 0,
  llmEnabled: false,
  llmModel: "anthropic/claude-3.5-haiku",
};

function neverFetch(): Fetcher {
  return (() => {
    throw new Error("must not fetch — the seam is off");
  }) as unknown as Fetcher;
}

describe("buildEnrichPrompt", () => {
  test("includes the finding's source/kind/title/body", () => {
    const prompt = buildEnrichPrompt(finding);
    expect(prompt).toContain(finding.title);
    expect(prompt).toContain(finding.body);
    expect(prompt).toContain(finding.source);
  });
});

describe("enrichFindings", () => {
  test("is a no-op (no fetch) when INTEL_LLM_ENABLED is off, even with a key present", async () => {
    const result = await enrichFindings(
      [finding],
      { ...baseConfig, llmEnabled: false, openrouterApiKey: "sk-or-x" },
      neverFetch(),
    );
    expect(result).toEqual([finding]);
  });

  test("is a no-op when enabled but no OPENROUTER_API_KEY is present", async () => {
    const result = await enrichFindings(
      [finding],
      { ...baseConfig, llmEnabled: true },
      neverFetch(),
    );
    expect(result).toEqual([finding]);
  });

  test("prepends the analysis to the body when armed and the call succeeds", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "This is a routine release." } }],
          }),
          { status: 200 },
        ),
      )) as unknown as Fetcher;
    const [result] = await enrichFindings(
      [finding],
      { ...baseConfig, llmEnabled: true, openrouterApiKey: "sk-or-x" },
      fetchImpl,
    );
    expect(result?.body).toContain("This is a routine release.");
    expect(result?.body).toContain(finding.body);
  });

  test("fails soft to the original finding when the call errors", async () => {
    const fetchImpl = (() =>
      Promise.reject(new Error("network down"))) as unknown as Fetcher;
    const result = await enrichFindings(
      [finding],
      { ...baseConfig, llmEnabled: true, openrouterApiKey: "sk-or-x" },
      fetchImpl,
    );
    expect(result).toEqual([finding]);
  });

  test("an oversized model response is capped, never left to overflow the finding's own 10,000-char body limit — the composed body drops the analysis it was meant to add rather than making parseFinding throw and lose the whole finding", async () => {
    const hugeAnalysis = "x".repeat(50_000);
    const fetchImpl = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: hugeAnalysis } }] }),
          { status: 200 },
        ),
      )) as unknown as Fetcher;
    const [result] = await enrichFindings(
      [finding],
      { ...baseConfig, llmEnabled: true, openrouterApiKey: "sk-or-x" },
      fetchImpl,
    );
    expect(result?.body.length).toBeLessThanOrEqual(10_000);
  });

  test("a finding whose own body is already large still composes under the cap after enrichment", async () => {
    const largeFinding: Finding = { ...finding, body: "y".repeat(9_000) };
    const fetchImpl = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "z".repeat(2_000) } }],
          }),
          { status: 200 },
        ),
      )) as unknown as Fetcher;
    const [result] = await enrichFindings(
      [largeFinding],
      { ...baseConfig, llmEnabled: true, openrouterApiKey: "sk-or-x" },
      fetchImpl,
    );
    expect(result?.body.length).toBeLessThanOrEqual(10_000);
  });
});
