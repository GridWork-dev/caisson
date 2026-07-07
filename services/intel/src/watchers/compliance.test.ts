import { describe, expect, test } from "bun:test";
import {
  complianceStateKeys,
  complianceWatcher,
  detectComplianceChanges,
  detectHipaaBreaches,
} from "./compliance.ts";
import type { FetchedSource } from "./compliance.ts";
import { logger } from "../logger.ts";
import { InMemoryStore } from "../store.ts";
import type { Config } from "../config.ts";
import type { Fetcher } from "../http.ts";
import type { WatcherCtx } from "./types.ts";

const ATOM_SOURCE: FetchedSource["source"] = {
  key: "oscal",
  label: "NIST OSCAL",
  url: "https://github.com/usnistgov/OSCAL/releases.atom",
  mode: "atom",
};

const HASH_SOURCE: FetchedSource["source"] = {
  key: "eu-ai-act-eurlex",
  label: "EU AI Act (EUR-Lex)",
  url: "https://eur-lex.europa.eu/x",
  mode: "hash",
};

const ATOM_V2 = `<feed><entry><link href="https://github.com/usnistgov/OSCAL/releases/tag/v2.0.0"/></entry></feed>`;

describe("detectComplianceChanges", () => {
  test("first observation records a silent baseline, no finding", () => {
    const { findings, nextState } = detectComplianceChanges(
      [{ source: ATOM_SOURCE, text: ATOM_V2 }],
      {},
    );
    expect(findings).toEqual([]);
    expect(nextState["compliance:oscal:version"]).toBe("v2.0.0");
  });

  test("a version bump against stored state emits a framework_release finding", () => {
    const { findings } = detectComplianceChanges(
      [{ source: ATOM_SOURCE, text: ATOM_V2 }],
      {
        "compliance:oscal:version": "v1.0.0",
      },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("framework_release");
    expect(findings[0]?.title).toContain("v2.0.0");
  });

  test("no change against stored state emits nothing", () => {
    const { findings } = detectComplianceChanges(
      [{ source: ATOM_SOURCE, text: ATOM_V2 }],
      {
        "compliance:oscal:version": "v2.0.0",
      },
    );
    expect(findings).toEqual([]);
  });

  test("a content-hash source emits framework_change on a hash mismatch", () => {
    const { findings } = detectComplianceChanges(
      [{ source: HASH_SOURCE, text: "new content" }],
      { "compliance:eu-ai-act-eurlex:hash": "deadbeef" },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("framework_change");
  });

  test("an empty body from a hash-mode source is no signal — it neither emits nor overwrites a stored baseline", () => {
    const { findings, nextState } = detectComplianceChanges(
      [{ source: HASH_SOURCE, text: "   " }],
      { "compliance:eu-ai-act-eurlex:hash": "deadbeef" },
    );
    expect(findings).toEqual([]);
    expect(nextState["compliance:eu-ai-act-eurlex:hash"]).toBeUndefined();
  });
});

describe("detectHipaaBreaches", () => {
  const html = `<table>
    <tr><th>Name</th></tr>
    <tr><td>Acme Health</td></tr>
    <tr><td>Beta Corp</td></tr>
  </table>`;

  test("first observation records a baseline, no finding", () => {
    const { findings } = detectHipaaBreaches(html, {});
    expect(findings).toEqual([]);
  });

  test("new rows since the stored baseline emit a hipaa_breach finding", () => {
    const baseline = detectHipaaBreaches(
      `<table><tr><th>Name</th></tr><tr><td>Acme Health</td></tr></table>`,
      {},
    ).nextState;
    const { findings } = detectHipaaBreaches(html, baseline);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.payload).toMatchObject({ newCount: 1 });
  });

  test("no new rows emits nothing", () => {
    const baseline = detectHipaaBreaches(html, {}).nextState;
    const { findings } = detectHipaaBreaches(html, baseline);
    expect(findings).toEqual([]);
  });

  test("an empty extraction (e.g. a transient 200) does not wipe an existing baseline", () => {
    const baseline = detectHipaaBreaches(html, {}).nextState;
    const { findings, nextState } = detectHipaaBreaches(
      "<table></table>",
      baseline,
    );
    expect(findings).toEqual([]);
    expect(nextState).toEqual({});
  });
});

const BASE_CONFIG: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "127.0.0.1",
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

describe("complianceWatcher.run (the run()-level wiring, not just the pure detect* functions)", () => {
  test("a fetch throw for ONE source leaves that source's watch_state key untouched; the rest still record a baseline", async () => {
    const store = new InMemoryStore();
    const throwingFetch: Fetcher = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://github.com/usnistgov/OSCAL/releases.atom") {
        throw new Error("network down");
      }
      if (url.includes("releases.atom")) {
        // A real GitHub releases.atom entry links to `.../releases/tag/<tag>` — NOT
        // `.../releases.atom/tag/<tag>` — so strip the `.atom` suffix before appending, or
        // latestAtomTag's `/releases/tag/` regex never matches.
        const tagUrl = `${url.replace(/\.atom$/, "")}/tag/v9.9.9`;
        return new Response(
          `<feed><entry><link href="${tagUrl}"/></entry></feed>`,
          {
            status: 200,
          },
        );
      }
      if (url.includes("ocrportal.hhs.gov")) {
        return new Response("<table><tr><td>Row A</td></tr></table>", {
          status: 200,
        });
      }
      return new Response("stable hash-mode content", { status: 200 });
    }) as unknown as Fetcher;

    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: throwingFetch,
      now: () => 1_000,
      logger,
    };

    await complianceWatcher.run(ctx);
    const state = await store.getWatchState(complianceStateKeys());

    // The source whose fetch threw never reaches detection — its key is absent, not overwritten.
    expect(state["compliance:oscal:version"]).toBeUndefined();
    // Every OTHER source's fetch succeeded and still recorded its baseline.
    expect(state["compliance:oscal-content:version"]).toBe("v9.9.9");
    expect(state["compliance:eu-ai-act-eurlex:hash"]).toBeDefined();
    expect(state["compliance:eu-ai-act-guidance:hash"]).toBeDefined();
    expect(state["compliance:hipaa:ids"]).toBeDefined();
  });
});
