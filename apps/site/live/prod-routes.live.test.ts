// live/prod-routes.live.test.ts — the LIVE production route-render proof for caisson.sh.
//
// Required env: CAISSON_E2E_CF_CLIENT_ID + CAISSON_E2E_CF_CLIENT_SECRET — the Cloudflare Access
// service token that bypasses the pre-launch site gate (ADR-0082, `infra/terraform/access.tf`
// `e2e_prober`) without weakening it: every request below carries `CF-Access-Client-Id` /
// `CF-Access-Client-Secret`, Service Auth (`decision = "non_identity"`), never a human bypass.
// Absent either var, this file self-skips entirely (never fails CI — it never runs there;
// `test:live` is its own turbo task, excluded from `check`/`test`).
//
// What it covers: drives a REAL Chromium browser (not a fetch) at a representative slice of the
// real router tree — home, the marketplace hub, the /pricing -> /marketplace redirect
// (ADR-0237 F1), /updates, the docs section, all four legal pages, sign-in, and a 3-module
// sample of the module depth pages (`lib/module-pages.ts` — the same registry `sitemap.ts` and
// `scripts/visual-harness.ts` derive from, so this list can't silently drift from the real
// catalog). Per route: the navigation succeeds (HTTP < 400), it lands on the expected path, no
// Cloudflare Access interstitial appeared, the page's H1 renders, and the browser logged no
// console/page errors (warnings are fine). Buyer-dashboard routes are a separate, session-gated
// leg — see `buyer-dashboard-flow.live.test.ts`.
//
// How to run: `bunx turbo run test:live --filter=@caisson/site` (or `cd apps/site && bun run
// test:live`) with both env vars set. `~/.gridwork/caisson.env` carries them for a dev-box run.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { LEGAL_ROUTES } from "@/lib/routes";
import { MODULE_PAGES } from "@/lib/module-pages";

const BASE_URL = "https://caisson.sh";
const NAV_TIMEOUT = 30_000; // Railway cold start + CF Access hop can be slow on the first hit
const TEST_TIMEOUT = 45_000;

const CF_CLIENT_ID = process.env.CAISSON_E2E_CF_CLIENT_ID ?? "";
const CF_CLIENT_SECRET = process.env.CAISSON_E2E_CF_CLIENT_SECRET ?? "";
const HAVE_CREDS = CF_CLIENT_ID.length > 0 && CF_CLIENT_SECRET.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);

interface ProdRoute {
  path: string;
  /** Final pathname after navigation, when it differs from `path` (a redirect). */
  expectPath?: string;
}

// Module depth pages derive from the real catalog registry (not hardcoded slugs) — "at least 3"
// per the operator ask; the first 3 is a representative sample, not an exhaustive sweep (that's
// `scripts/visual-harness.ts`'s job, over a dev server).
const MODULE_SAMPLE: readonly ProdRoute[] = MODULE_PAGES.slice(0, 3).map(
  (m) => ({
    path: `/marketplace/modules/${m.slug}`,
  }),
);

const ROUTES: readonly ProdRoute[] = [
  { path: "/" },
  { path: "/marketplace" },
  // ADR-0237 F1: /pricing permanently 301s to the unified /marketplace hub.
  { path: "/pricing", expectPath: "/marketplace" },
  { path: "/updates" },
  { path: "/docs" },
  ...LEGAL_ROUTES.map((r): ProdRoute => ({ path: r.path })),
  { path: "/login" },
  ...MODULE_SAMPLE,
];

// A known, root-caused CSP gap — NOT a harness bug (2026-07-07 first live run, root-caused
// 2026-07-08, CAISSON-51/CAISSON-50). Cloudflare auto-injects a Web Analytics ("Insights") beacon
// from `static.cloudflareinsights.com` at the zone level on a SAMPLED subset of real-browser
// requests (confirmed live: present on one `/login` fetch, absent on a same-session `/` fetch with
// identical browser-realistic headers — it is not deterministic per route). The site's own CSP
// `script-src` (next.config.ts) does not allow that origin, so Chromium logs the block as a
// console error on EVERY page it lands on. Filtered narrowly by domain (not a blanket CSP
// exception) so the sweep can still catch a real per-route regression instead of drowning in this
// one already-known, site-wide signal.
//
// This SAME injected `<script>` — appended as the literal last child of `<body>`, outside React's
// own rendered tree — is also the confirmed root cause of CAISSON-50 (the `/login` minified React
// error #418 this harness caught): React's hydration walk over `document` finds the unexpected
// extra node and throws. It reproduced live twice and never reproduced locally with Cloudflare out
// of the path (dev / `next start` / the real standalone `server.js`, 8-iteration loop), which is
// what pins the cause on the edge injection rather than `/login`'s own code.
//
// Fix prepared, NOT yet applied: `infra/terraform/web-analytics.tf` adopts the existing
// dashboard-created Web Analytics site and disables auto-injection (`auto_install = false`).
// `terraform apply` is an operator DEPLOY act — until it lands, `/login` (and, rarely, other
// routes on an unlucky sample) may still intermittently fail this sweep with error #418; that is
// the known, tracked, pre-apply state, not a regression. Once applied, remove this KNOWN_NOISE
// entry — the beacon will no longer exist to filter.
const KNOWN_NOISE: readonly RegExp[] = [/static\.cloudflareinsights\.com/];

function isKnownNoise(message: string): boolean {
  return KNOWN_NOISE.some((re) => re.test(message));
}

let browser: Browser | null = null;
let context: BrowserContext | null = null;

function requireContext(): BrowserContext {
  if (context === null) throw new Error("browser context not initialized");
  return context;
}

async function assertRoute(
  ctx: BrowserContext,
  route: ProdRoute,
): Promise<void> {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    // "load" not "networkidle" — a persistent analytics/HMR connection never lets networkidle
    // fire and the nav times out even though the page rendered fine long ago (proven gotcha,
    // `scripts/visual-harness.ts`).
    const res = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "load",
      timeout: NAV_TIMEOUT,
    });
    if (res === null) throw new Error(`${route.path}: no navigation response`);
    expect(res.status(), `${route.path}: HTTP ${res.status()}`).toBeLessThan(
      400,
    );

    const finalUrl = page.url();
    expect(
      finalUrl,
      `${route.path}: bounced to a Cloudflare Access interstitial`,
    ).not.toContain("cloudflareaccess.com");
    expect(
      new URL(finalUrl).pathname,
      `${route.path}: landed on an unexpected path`,
    ).toBe(route.expectPath ?? route.path);

    // "a main content element" — every route type here renders one H1 (marketing Hero, the
    // dashboard's own h1, fumadocs' DocsTitle), which is a steadier signal across this app's
    // several distinct layouts than hunting a <main> wrapper that not every layout uses.
    await page
      .locator('main, [role="main"], #main-content, h1')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await page.waitForTimeout(500); // let deferred scripts (analytics init, etc.) settle
    const realErrors = [...consoleErrors, ...pageErrors].filter(
      (m) => !isKnownNoise(m),
    );
    expect(realErrors, `${route.path}: browser errors`).toEqual([]);
  } finally {
    await page.close();
  }
}

describe("production route sweep — every route renders in a real browser (CF Access bypassed via service token)", () => {
  beforeAll(async () => {
    if (!HAVE_CREDS) return;
    browser = await chromium.launch();
    context = await browser.newContext({
      extraHTTPHeaders: {
        "CF-Access-Client-Id": CF_CLIENT_ID,
        "CF-Access-Client-Secret": CF_CLIENT_SECRET,
      },
    });
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  for (const route of ROUTES) {
    liveTest(
      `${route.path === "" ? "/" : route.path} renders cleanly, no console errors, no CF interstitial`,
      async () => {
        await assertRoute(requireContext(), route);
      },
      TEST_TIMEOUT,
    );
  }
});
