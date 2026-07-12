// Hermetic unit tests for the cassette boundary — the always-run coverage that keeps this branch
// meaningfully tested with zero cassettes committed. Covers the strict schema, the scrub/assert
// fail-closed gate, the FIFO fail-closed replay fetcher, and the dummy-cred replay config.
import { describe, expect, test } from "bun:test";
import {
  assertScrubbed,
  buildReplayFetcher,
  parseCassetteFile,
  replayConfig,
  scrubText,
} from "./cassette.ts";

const VALID_CASSETTE = {
  schemaVersion: 1,
  watcher: "competitor",
  recordedAt: "2026-07-11T12:00:00.000Z",
  config: {
    competitorUrls: ["https://a.example.com/pricing"],
    githubOrg: "caisson-sh",
    posthogApiHost: "https://us.posthog.com",
    posthogProjectId: "493539",
    plausibleApiHost: "https://plausible.io",
    credsPresent: {
      githubToken: false,
      posthogApiKey: false,
      plausibleApiKey: false,
    },
  },
  watchState: {},
  exchanges: [],
  findings: [],
  judge: { model: "anthropic/claude-sonnet-4.5", responses: {} },
} as const;

describe("parseCassetteFile (strict boundary)", () => {
  test("accepts a well-formed cassette", () => {
    expect(parseCassetteFile(VALID_CASSETTE).watcher).toBe("competitor");
  });

  test("rejects an unknown top-level key", () => {
    expect(() => parseCassetteFile({ ...VALID_CASSETTE, bogus: 1 })).toThrow();
  });

  test("rejects a malformed finding", () => {
    expect(() =>
      parseCassetteFile({
        ...VALID_CASSETTE,
        findings: [{ source: "competitor" }],
      }),
    ).toThrow();
  });

  test("rejects a non-ISO recordedAt", () => {
    expect(() =>
      parseCassetteFile({ ...VALID_CASSETTE, recordedAt: "yesterday" }),
    ).toThrow();
  });

  test("rejects an unknown key inside config", () => {
    expect(() =>
      parseCassetteFile({
        ...VALID_CASSETTE,
        config: { ...VALID_CASSETTE.config, leaked: "x" },
      }),
    ).toThrow();
  });
});

describe("scrubText", () => {
  test("redacts a known secret value literally (regex metachars and all)", () => {
    expect(
      scrubText("dsn=postgres://u:p.a$$@h/db end", ["postgres://u:p.a$$@h/db"]),
    ).toBe("dsn=[redacted] end");
  });

  test("redacts a Bearer token", () => {
    const out = scrubText("authorization: Bearer abcd1234efgh5678ijkl", []);
    expect(out).not.toContain("abcd1234");
    expect(out).toContain("[redacted]");
  });

  test("redacts each key-prefixed token class", () => {
    for (const token of [
      "phc_abcdefgh1234",
      "phx_abcdefgh1234",
      "lin_api_abcdefgh",
      "sk-abcdefgh1234",
      "ghp_abcdefgh1234",
      "github_pat_abcdefgh1234",
    ]) {
      const out = scrubText(`key=${token} tail`, []);
      expect(out).toBe("key=[redacted] tail");
    }
  });

  test("redacts emails to a stable token", () => {
    expect(scrubText("ping ops@caisson.sh now", [])).toBe(
      "ping [redacted-email] now",
    );
  });
});

describe("assertScrubbed (fail-closed write gate)", () => {
  test("throws when a secret value survives", () => {
    expect(() =>
      assertScrubbed('{"body":"leak TOPSECRET here"}', ["TOPSECRET"]),
    ).toThrow(/scrub gate failed/);
  });

  test("passes when nothing survives", () => {
    expect(() =>
      assertScrubbed('{"body":"[redacted]"}', ["TOPSECRET"]),
    ).not.toThrow();
  });

  test("its error message never echoes the surviving secret", () => {
    let message = "";
    try {
      assertScrubbed("carrying TOPSECRET", ["TOPSECRET"]);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).not.toContain("TOPSECRET");
  });
});

describe("buildReplayFetcher", () => {
  test("replays matched exchanges FIFO", async () => {
    const fetcher = buildReplayFetcher([
      { method: "GET", url: "https://x.test/a", status: 200, body: "first" },
      { method: "GET", url: "https://x.test/a", status: 201, body: "second" },
    ]);
    const r1 = await fetcher("https://x.test/a");
    expect(r1.status).toBe(200);
    expect(await r1.text()).toBe("first");
    const r2 = await fetcher("https://x.test/a");
    expect(r2.status).toBe(201);
    expect(await r2.text()).toBe("second");
  });

  test("echoes the recorded content-type", async () => {
    const fetcher = buildReplayFetcher([
      {
        method: "GET",
        url: "https://x.test/j",
        status: 200,
        contentType: "application/json",
        body: "{}",
      },
    ]);
    const res = await fetcher("https://x.test/j");
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  test("throws on a miss (fail-closed — never reaches the network)", () => {
    const fetcher = buildReplayFetcher([]);
    expect(() => fetcher("https://x.test/none")).toThrow(/replay miss/);
  });

  test("keys on method too — a POST to a GET-recorded url misses", () => {
    const fetcher = buildReplayFetcher([
      { method: "GET", url: "https://x.test/a", status: 200, body: "ok" },
    ]);
    expect(() => fetcher("https://x.test/a", { method: "POST" })).toThrow(
      /replay miss/,
    );
  });
});

describe("replayConfig", () => {
  test("injects dummy creds only for present legs and forces llm off", () => {
    const cassette = parseCassetteFile({
      ...VALID_CASSETTE,
      config: {
        ...VALID_CASSETTE.config,
        plausibleSiteId: "site-123",
        credsPresent: {
          githubToken: true,
          posthogApiKey: false,
          plausibleApiKey: true,
        },
      },
    });
    const cfg = replayConfig(cassette);
    expect(cfg.githubToken).toBe("replay-dummy");
    expect(cfg.posthogApiKey).toBeUndefined();
    expect(cfg.plausibleApiKey).toBe("replay-dummy");
    expect(cfg.plausibleSiteId).toBe("site-123");
    expect(cfg.llmEnabled).toBe(false);
    expect(cfg.competitorUrls).toEqual(["https://a.example.com/pricing"]);
    // The throwaway DSN is never dialed in replay (InMemoryStore stands in) but must be non-empty.
    expect(cfg.databaseUrl.length).toBeGreaterThan(0);
  });
});
