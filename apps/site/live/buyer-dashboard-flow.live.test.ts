// live/buyer-dashboard-flow.live.test.ts — the LIVE buyer-dashboard session proof.
//
// Required env: CAISSON_E2E_CF_CLIENT_ID + CAISSON_E2E_CF_CLIENT_SECRET (the CF Access service
// token — see `prod-routes.live.test.ts`'s header) PLUS CAISSON_E2E_ACCOUNT_EMAIL +
// CAISSON_E2E_ACCOUNT_PASSWORD (a real caisson.sh buyer account reserved for this probe). Absent
// any of the four, this file self-skips entirely (never fails CI — it never runs there).
//
// What it covers: signs the probe account in via better-auth's own `/api/auth/sign-in/email`
// (self-serve `/api/auth/sign-up/email` on first run — `ensureProbeSession` below), then drives
// a REAL browser through the authed dashboard: overview, license, and credits. The probe account
// is deliberately zero-purchase — every assertion below is that the EMPTY state renders (an
// `EmptyState` component, a $0 balance, an empty ledger), never a blank page or an error
// boundary.
//
// Known limitation (not a harness bug): better-auth's password flow requires email verification
// before a NEW account can sign in (`apps/site/lib/auth-server.ts` — `requireEmailVerification:
// true`), a real inbox click this harness has no way to automate. The FIRST run against a
// brand-new probe account signs it up, then correctly reports "no session" (see the session test
// below) — that is the harness surfacing the one manual step honestly, not swallowing it. Once
// the operator opens that one verification email and clicks it, every later run signs in
// directly and the dashboard assertions exercise the real pages.
//
// How to run: `bunx turbo run test:live --filter=@caisson/site` (or `cd apps/site && bun run
// test:live`) with all four env vars set.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

const BASE_URL = "https://caisson.sh";
const NAV_TIMEOUT = 30_000;
const TEST_TIMEOUT = 45_000;

const CF_CLIENT_ID = process.env.CAISSON_E2E_CF_CLIENT_ID ?? "";
const CF_CLIENT_SECRET = process.env.CAISSON_E2E_CF_CLIENT_SECRET ?? "";
const PROBE_EMAIL = process.env.CAISSON_E2E_ACCOUNT_EMAIL ?? "";
const PROBE_PASSWORD = process.env.CAISSON_E2E_ACCOUNT_PASSWORD ?? "";

const HAVE_CREDS =
  CF_CLIENT_ID.length > 0 &&
  CF_CLIENT_SECRET.length > 0 &&
  PROBE_EMAIL.length > 0 &&
  PROBE_PASSWORD.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let sessionEstablished = false;

function requireContext(): BrowserContext {
  if (context === null) throw new Error("browser context not initialized");
  return context;
}

/**
 * POST the sign-in boundary. Playwright's `APIRequestContext` shares the context's cookie jar
 * with every `page.goto` in that same context, so a successful response's session cookie needs
 * no manual Set-Cookie parsing — it is simply there for the next navigation.
 */
async function trySignIn(ctx: BrowserContext): Promise<boolean> {
  const res = await ctx.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
    data: { email: PROBE_EMAIL, password: PROBE_PASSWORD },
    timeout: 15_000,
  });
  return res.ok();
}

/** Idempotent: sign-in first; self-serve sign-up only on that failing (account missing, or —
 *  per the file header — pending its one-time email verification, in which case this still
 *  returns false and the caller reports it plainly instead of faking a pass). */
async function ensureProbeSession(ctx: BrowserContext): Promise<boolean> {
  if (await trySignIn(ctx)) return true;
  await ctx.request.post(`${BASE_URL}/api/auth/sign-up/email`, {
    data: {
      name: "Caisson E2E Probe",
      email: PROBE_EMAIL,
      password: PROBE_PASSWORD,
    },
    timeout: 15_000,
  });
  return trySignIn(ctx);
}

/** True when `page` rendered an `EmptyState` (`.cs-empty`, `packages/ui/src/components/
 *  empty-state.tsx`) whose title contains `titleFragment`. */
async function hasEmptyState(
  page: Page,
  titleFragment: string,
): Promise<boolean> {
  const title = page.locator(".cs-empty .cs-empty__title", {
    hasText: titleFragment,
  });
  return (await title.count()) > 0;
}

beforeAll(async () => {
  if (!HAVE_CREDS) return;
  browser = await chromium.launch();
  context = await browser.newContext({
    extraHTTPHeaders: {
      "CF-Access-Client-Id": CF_CLIENT_ID,
      "CF-Access-Client-Secret": CF_CLIENT_SECRET,
    },
  });
  try {
    sessionEstablished = await ensureProbeSession(context);
  } catch {
    sessionEstablished = false;
  }
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
});

describe("buyer-dashboard flow — probe account, empty-state assertions", () => {
  liveTest(
    "the probe account has a session (sign-in, or self-serve sign-up on first run)",
    () => {
      expect(
        sessionEstablished,
        "no session — either the credentials are wrong, or (first run against a brand-new " +
          "probe account) sign-up fired and is waiting on its one-time email verification; " +
          "see the file header.",
      ).toBe(true);
    },
  );

  liveTest(
    "/dashboard renders the overview empty state (no entitlements yet)",
    async () => {
      if (!sessionEstablished) return; // reported by the session test above; do not double-fail
      const page = await requireContext().newPage();
      try {
        const res = await page.goto(`${BASE_URL}/dashboard`, {
          waitUntil: "load",
          timeout: NAV_TIMEOUT,
        });
        if (res === null) throw new Error("/dashboard: no navigation response");
        expect(res.status(), `/dashboard: HTTP ${res.status()}`).toBeLessThan(
          400,
        );
        expect(
          new URL(page.url()).pathname,
          "/dashboard redirected — the session did not stick",
        ).toBe("/dashboard");
        await page
          .locator("h1", { hasText: "Overview" })
          .waitFor({ state: "visible", timeout: 10_000 });
        expect(await hasEmptyState(page, "No entitlements yet")).toBe(true);
      } finally {
        await page.close();
      }
    },
    TEST_TIMEOUT,
  );

  liveTest(
    "/dashboard/license renders the license empty state (no issued license, no updates window)",
    async () => {
      if (!sessionEstablished) return;
      const page = await requireContext().newPage();
      try {
        const res = await page.goto(`${BASE_URL}/dashboard/license`, {
          waitUntil: "load",
          timeout: NAV_TIMEOUT,
        });
        if (res === null)
          throw new Error("/dashboard/license: no navigation response");
        expect(
          res.status(),
          `/dashboard/license: HTTP ${res.status()}`,
        ).toBeLessThan(400);
        await page
          .locator("h1", { hasText: "License" })
          .waitFor({ state: "visible", timeout: 10_000 });
        expect(await hasEmptyState(page, "No license issued yet")).toBe(true);
        // A zero-entitlement account correctly renders NO updates-window section — the "Updates"
        // heading only appears per ACTIVE entitlement (dashboard/license/page.tsx). Its absence
        // here IS the correct empty-state assertion, not a gap in coverage.
        expect(await page.locator("h2", { hasText: "Updates" }).count()).toBe(
          0,
        );
      } finally {
        await page.close();
      }
    },
    TEST_TIMEOUT,
  );

  liveTest(
    "/dashboard/credits renders a zero balance and an empty ledger, not a blank or error page",
    async () => {
      if (!sessionEstablished) return;
      const page = await requireContext().newPage();
      try {
        const res = await page.goto(`${BASE_URL}/dashboard/credits`, {
          waitUntil: "load",
          timeout: NAV_TIMEOUT,
        });
        if (res === null)
          throw new Error("/dashboard/credits: no navigation response");
        expect(
          res.status(),
          `/dashboard/credits: HTTP ${res.status()}`,
        ).toBeLessThan(400);
        await page
          .locator("h1", { hasText: "Credits" })
          .waitFor({ state: "visible", timeout: 10_000 });
        // No purchases -> no expiring-credits badge (the `expiring.credits > 0` gate) and the
        // ledger falls back to its own built-in EmptyState (packages/ui LedgerList default).
        expect(await page.locator("text=Expiring within 30 days").count()).toBe(
          0,
        );
        expect(await hasEmptyState(page, "No ledger activity yet")).toBe(true);
      } finally {
        await page.close();
      }
    },
    TEST_TIMEOUT,
  );
});
