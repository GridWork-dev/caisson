// live/prod-gate.live.test.ts — the LIVE production gate probe for admin.caisson.sh
// (public surface only; ADR-0283 in-app GitHub OAuth + numeric-id allowlist).
//
// Two assertions, both against unauthenticated targets by design:
//  1. GET /healthz reports readiness — the Railway probe that fails closed if the admin image's
//     better-auth migration didn't run (`src/app/healthz/route.ts`), proving the deployed image
//     actually booted.
//  2. GET a page route with no session cookie redirects to /login — proving the app-wide auth
//     gate (`src/proxy.ts`) is live: every route except /login, /healthz, and /api/auth/* denies
//     an unauthenticated visitor. This harness deliberately never attempts an authed admin
//     flow — the operator's own GitHub OAuth is out of reach for an automated probe, and out of
//     scope for this harness.
//
// No credential to self-skip on: both targets are public and unauthenticated by design (admin no
// longer sits behind Cloudflare Access — ADR-0283 removed that resource; the app gates itself).
// It still lives in live/ (never `bun test ./src`, never CI) to keep this prod-network dependency
// out of the default suite, matching the ADR-0201 convention every other `live/` file follows.
//
// How to run: `bunx turbo run test:live --filter=@caisson/admin` (or `cd apps/admin && bun run
// test:live`).
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { fetchWithTimeout } from "@caisson/kernel";

const BASE_URL = "https://admin.caisson.sh";
const TIMEOUT = 15_000;

const healthzSchema = z
  .object({
    ok: z.boolean(),
    indexDigest: z.string().optional(),
    indexEntries: z.number().optional(),
  })
  .strict();

describe("admin.caisson.sh production gate — public surface only", () => {
  test(
    "/healthz reports ready",
    async () => {
      const res = await fetchWithTimeout(
        `${BASE_URL}/healthz`,
        {},
        { timeoutMs: TIMEOUT },
      );
      expect(res.status, `/healthz: HTTP ${res.status}`).toBe(200);
      const body = healthzSchema.parse(await res.json());
      expect(body.ok).toBe(true);
    },
    TIMEOUT + 5_000,
  );

  test(
    "an unauthenticated page request redirects to /login",
    async () => {
      const res = await fetchWithTimeout(
        `${BASE_URL}/catalog`,
        { redirect: "manual" },
        { timeoutMs: TIMEOUT },
      );
      // proxy.ts's deny() issues a same-origin redirect to /login?next=<path> for a page route
      // (an /api/* route would 401 instead — not exercised here).
      expect(
        [301, 302, 307, 308],
        `/catalog: HTTP ${res.status} (expected a redirect)`,
      ).toContain(res.status);
      const location = res.headers.get("location") ?? "";
      expect(new URL(location, BASE_URL).pathname).toBe("/login");
    },
    TIMEOUT + 5_000,
  );
});
