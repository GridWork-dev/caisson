// live/watchers.live.test.ts — proves the wiring against the REAL external endpoints, not just
// fixtures. Self-skips per repo convention (ADR-0201): even the credential-free legs (GitHub's
// public API, the OSCAL releases.atom feed) require an explicit opt-in var so a real network call
// never fires in CI or a default `bun test` run — `HAVE_CREDS`/`OPT_IN` gating mirrors
// packages/field-crypto/live/kms-gcp.live.test.ts for a source with no required secret.
import { describe, expect, test } from "bun:test";
import { fetchWithTimeout } from "@caisson/kernel";
import { latestAtomTag } from "../src/detect.ts";
import { fetchText } from "../src/http.ts";
import { parseErrorGroups, parseRollup } from "../src/posthog.ts";
import { parseRepos } from "../src/watchers/github.ts";

const TIMEOUT = 15_000;

// Credential-free legs — public endpoints, still opt-in only.
const OPT_IN = process.env.INTEL_LIVE_TESTS ?? "";
const publicTest = test.skipIf(OPT_IN.length === 0);

// PostHog — requires the real project key, project id defaults to caisson-prod.
const POSTHOG_KEY = process.env.POSTHOG_API_KEY ?? "";
const POSTHOG_HOST = process.env.POSTHOG_API_HOST ?? "https://us.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "493539";
const posthogTest = test.skipIf(POSTHOG_KEY.length === 0);

describe("github public API", () => {
  publicTest(
    "GET /orgs/:org/repos returns a parseable repo list",
    async () => {
      const res = await fetchWithTimeout(
        "https://api.github.com/orgs/caisson-sh/repos?per_page=10&type=public",
        {
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": "caisson-intel-live-test",
          },
        },
        { timeoutMs: TIMEOUT },
      );
      expect(res.ok).toBe(true);
      const repos = parseRepos(await res.json());
      expect(Array.isArray(repos)).toBe(true);
    },
    TIMEOUT,
  );
});

describe("OSCAL releases.atom", () => {
  publicTest(
    "the real feed yields a parseable release tag",
    async () => {
      const xml = await fetchText(
        fetchWithTimeout,
        "https://github.com/usnistgov/OSCAL/releases.atom",
        {},
        TIMEOUT,
      );
      const tag = latestAtomTag(xml);
      expect(tag).not.toBeNull();
      expect(tag ?? "").toMatch(/^v?\d/);
    },
    TIMEOUT,
  );
});

describe("PostHog query + error-tracking APIs", () => {
  posthogTest(
    "the daily rollup query returns a parseable shape",
    async () => {
      const res = await fetchWithTimeout(
        `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${POSTHOG_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            query: {
              kind: "HogQLQuery",
              query:
                "SELECT count() AS events, count(DISTINCT person_id) AS users FROM events WHERE timestamp >= now() - INTERVAL 1 DAY",
            },
          }),
        },
        { timeoutMs: TIMEOUT },
      );
      expect(res.ok).toBe(true);
      const rollup = parseRollup(await res.json());
      expect(rollup.events).toBeGreaterThanOrEqual(0);
    },
    TIMEOUT,
  );

  posthogTest(
    "the error-tracking issues endpoint returns a parseable shape",
    async () => {
      const res = await fetchWithTimeout(
        `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/error_tracking/issues/`,
        { headers: { authorization: `Bearer ${POSTHOG_KEY}` } },
        { timeoutMs: TIMEOUT },
      );
      expect(res.ok).toBe(true);
      expect(Array.isArray(parseErrorGroups(await res.json()))).toBe(true);
    },
    TIMEOUT,
  );
});
