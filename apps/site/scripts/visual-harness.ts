#!/usr/bin/env bun
/**
 * Categorized full-surface visual harness for caisson.sh — a LOCAL operator tool, never CI.
 *
 * Captures every visual surface at mobile + desktop widths, each in light + dark mode, with
 * `fullPage: true` (viewport WIDTH stays a real device width; height captures the whole page):
 *
 *   - every page route (marketing, marketplace, module depth, writing, docs, legal) — derived
 *     from the canonical `lib/routes.ts` registry
 *   - the marketplace card-viewer pop-outs (`?view=bundle:<slug>` / `?view=module:<slug>` deep links)
 *   - every branded email template (`@caisson-sh/email` rendered with EMAIL_SAMPLE_DATA)
 *   - interaction states (mobile nav drawer, docs search, marketplace search, module media
 *     carousel) — a failed interaction is recorded in the manifest as a behavior signal, not
 *     silently skipped
 *
 * Targets a local server by default. `--prod` targets https://caisson.sh through the CF-Access
 * pre-launch gate using the e2e_prober service token (CAISSON_E2E_CF_CLIENT_ID/SECRET — same
 * bypass as live/prod-routes.live.test.ts; Service Auth, never a human bypass).
 *
 * Output: ONE clean run directory (default outputs/visual-audit/<date>/, gitignored) with one
 * subdirectory per category and a manifest.json describing every shot (route, viewport, mode,
 * console errors, interaction failures).
 *
 * Usage:
 *   bun run scripts/visual-harness.ts [--prod] [--base-url http://localhost:3030]
 *                                     [--out outputs/visual-audit/<date>] [--only <category>]
 */
import { mkdir } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  EMAIL_SAMPLE_DATA,
  EMAIL_TEMPLATE_IDS,
  renderEmailTemplate,
} from "@caisson-sh/email";
import { BUNDLE_PAGES } from "../lib/bundle-pages.ts";
import { LEGAL_ROUTES, MARKETING_ROUTES } from "../lib/routes.ts";
import { MODULE_PAGES } from "../lib/module-pages.ts";
import { WRITING_PIECES } from "../lib/writing.tsx";

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const MOBILE_VIEWPORT: Viewport = { name: "mobile", width: 390, height: 844 };
const DESKTOP_VIEWPORT: Viewport = {
  name: "desktop",
  width: 1280,
  height: 900,
};
const VIEWPORTS: readonly Viewport[] = [MOBILE_VIEWPORT, DESKTOP_VIEWPORT];

const MODES: readonly ("light" | "dark")[] = ["light", "dark"];

export type ShotCategory =
  | "marketing"
  | "marketplace"
  | "module"
  | "popout"
  | "writing"
  | "docs"
  | "legal"
  | "email"
  | "interaction"
  | "motion";

interface Shot {
  category: ShotCategory;
  /** Unique within its category; becomes the filename stem. */
  name: string;
  /** Page shots navigate here (may carry a query string for deep-linked pop-outs). */
  route?: string;
  /** Email shots render this HTML from a file:// URL instead of navigating the site. */
  html?: string;
  /** Interaction shots run this after navigation, before the screenshot. */
  act?: (page: Page) => Promise<void>;
  /** Restrict to a subset of viewports (e.g. the mobile nav drawer only exists on mobile). */
  viewports?: readonly Viewport[];
  /** Interactions capture the viewport (modal/drawer state); pages capture the full page. */
  fullPage?: boolean;
  /** Motion-leg shots run WITHOUT reducedMotion (they capture the ADR-0334 transition states);
   *  everything else keeps `reducedMotion: "reduce"` for deterministic diffs. */
  motion?: boolean;
}

interface ShotResult {
  category: ShotCategory;
  name: string;
  route?: string | undefined;
  viewport: string;
  mode: string;
  file: string;
  ok: boolean;
  error?: string | undefined;
  consoleErrors?: readonly string[] | undefined;
  skipped?: string | undefined;
}

// Public page routes DERIVE from the canonical marketing registry (`lib/routes.ts`) — the same
// list the sitemap, nav, and footer read. They used to be literal arrays here, and drifted: by
// C25 the harness had silently stopped shooting /writing, /trust, /support and
// /frameworks/eu-ai-act/article-50. A registry row is now a shot by construction.

/** Every canonical public path, `""` normalized to `/`. Legal rows come out via LEGAL_ROUTES. */
const PUBLIC_ROUTES: readonly string[] = MARKETING_ROUTES.filter(
  (r) => r.group !== "legal",
).map((r) => r.path || "/");

/** Which public paths shoot as `marketplace` rather than `marketing` — a category judgement the
 *  registry does not encode, so it is a membership test, never a route list: a new registry row
 *  is still captured (as `marketing`) whether or not it is named here. */
const COMMERCE_PATHS: ReadonlySet<string> = new Set(["/marketplace"]);

const MARKETING_PAGE_ROUTES: readonly string[] = PUBLIC_ROUTES.filter(
  (p) => !COMMERCE_PATHS.has(p),
);

const MARKETPLACE_ROUTES: readonly string[] = PUBLIC_ROUTES.filter((p) =>
  COMMERCE_PATHS.has(p),
);

/** Dated-commentary spokes, derived exactly as `app/sitemap.ts` derives them. WRITING_DRAFTS is
 *  deliberately unpublished and has no route, so it is deliberately not read here. */
const WRITING_ROUTES: readonly string[] = WRITING_PIECES.map(
  (piece) => `/writing/${piece.slug}`,
);

/** content/docs/**.mdx → /docs routes ("index" collapses to its directory). */
export function docsRoutes(): readonly string[] {
  const root = join(import.meta.dir, "..", "content", "docs");
  const routes: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        walk(join(dir, entry.name), `${prefix}/${entry.name}`);
      else if (entry.name.endsWith(".mdx")) {
        const stem = entry.name.replace(/\.mdx$/, "");
        routes.push(
          stem === "index" ? `/docs${prefix}` : `/docs${prefix}/${stem}`,
        );
      }
    }
  };
  walk(root, "");
  return routes.sort();
}

/**
 * The page-route half of the shot list, categorised — the ONE composition both `allRoutes()` and
 * `main()` read. It used to be written out twice, once in each, over the same constants: the tests
 * asserted against `allRoutes()` while `main()` decided what actually got shot, so "a registry row
 * is a shot by construction" was one hop stronger than anything proven. The two agreed by hand.
 * Now they agree because there is only one list (ADR-0413).
 */
export function pageShotGroups(): readonly {
  category: ShotCategory;
  routes: readonly string[];
}[] {
  return [
    { category: "marketing", routes: MARKETING_PAGE_ROUTES },
    { category: "marketplace", routes: MARKETPLACE_ROUTES },
    { category: "legal", routes: LEGAL_ROUTES.map((r) => r.path) },
    {
      category: "module",
      routes: MODULE_PAGES.map((m) => `/marketplace/modules/${m.slug}`),
    },
    { category: "writing", routes: WRITING_ROUTES },
    { category: "docs", routes: docsRoutes() },
  ];
}

export function allRoutes(): readonly string[] {
  return pageShotGroups().flatMap((group) => [...group.routes]);
}

/** Route → filename-safe slug ("/" → "home"; "/" → "__"; query/anything unsafe → "-"). */
export function routeSlug(route: string): string {
  if (route === "/") return "home";
  return route
    .replace(/^\//, "")
    .replace(/\//g, "__")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function pageShots(category: ShotCategory, routes: readonly string[]): Shot[] {
  return routes.map((route) => ({ category, name: routeSlug(route), route }));
}

async function emailShots(): Promise<Shot[]> {
  const shots: Shot[] = [];
  for (const id of EMAIL_TEMPLATE_IDS) {
    const { html } = await renderEmailTemplate(id, EMAIL_SAMPLE_DATA[id]);
    shots.push({ category: "email", name: id, html });
  }
  return shots;
}

function interactionShots(): Shot[] {
  // getByRole, not a [role=…] CSS selector — the card viewer is a native <dialog> whose role is
  // implicit, so an attribute selector never matches it.
  const inDialog = (page: Page) => page.getByRole("dialog");
  return [
    {
      category: "interaction",
      name: "mobile-nav-open",
      route: "/",
      viewports: [MOBILE_VIEWPORT],
      fullPage: false,
      act: async (page) => {
        await page.getByLabel("Open menu").first().click();
        await page.waitForTimeout(600);
      },
    },
    {
      category: "interaction",
      name: "docs-search-open",
      route: "/docs",
      fullPage: false,
      // Fumadocs binds Ctrl/Cmd+K — steadier than hunting its viewport-dependent trigger buttons.
      act: async (page) => {
        await page.keyboard.press("ControlOrMeta+k");
        await page.waitForTimeout(600);
      },
    },
    {
      category: "interaction",
      name: "marketplace-search-filtered",
      route: "/marketplace",
      fullPage: false,
      act: async (page) => {
        await page
          .locator('input[type="search"], input[placeholder*="earch"]')
          .first()
          .fill("audit");
        await page.waitForTimeout(600);
      },
    },
    {
      category: "interaction",
      name: "popout-media-carousel-next",
      // NOT popoutRoute: the card viewer omits the code-artifact slide (ADR-0290 WR-03), so a
      // module with a single targeting diagram renders the single-slide layout — no nav buttons
      // to click. audit-worm carries its live ChainViewer component slide plus its bespoke
      // schematic sheet (ADR-0377), so its viewer always has a real carousel.
      route: "/marketplace?view=module:audit-worm",
      fullPage: false,
      // The slide carousel lives in the card-viewer pop-out (module depth pages have no controls).
      act: async (page) => {
        await inDialog(page).getByLabel("Next slide").first().click();
        await page.waitForTimeout(600);
      },
    },
  ];
}

/** Motion-leg shots (ADR-0334 §7 evidence — one per moment; desktop-only since the moments gate
 *  on lg/hover). Each act drives the moment into a characteristic state and settles briefly; the
 *  screenshots are the per-moment transition-state record the visual harness diffs across waves.
 *  Chrome Persists is exercised by nav (mid-flight VT frames aren't deterministic to capture). */
function motionShots(): Shot[] {
  return [
    {
      category: "motion",
      name: "seal-on-proof-chips",
      route: "/",
      viewports: [DESKTOP_VIEWPORT],
      fullPage: false,
      motion: true,
      act: async (page) => {
        await page
          .evaluate(() =>
            document
              .querySelector("[data-doors]")
              ?.parentElement?.querySelector("div:last-child")
              ?.scrollIntoView({ block: "center" }),
          )
          .catch(() => {});
        await page.waitForTimeout(1200); // seal draw + stagger settles
      },
    },
    {
      category: "motion",
      name: "waterline-descent-mid",
      route: "/",
      viewports: [DESKTOP_VIEWPORT],
      fullPage: false,
      motion: true,
      act: async (page) => {
        // Mid-exit of the hero: the depth layer and lattice sink are mid-scrub.
        await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.6));
        await page.waitForTimeout(500);
      },
    },
    {
      category: "motion",
      name: "doors-hover-lift",
      route: "/",
      viewports: [DESKTOP_VIEWPORT],
      fullPage: false,
      motion: true,
      act: async (page) => {
        await page.waitForTimeout(2600); // idle gate: spring enhancer attaches post-load
        await page.locator("[data-door][data-lead]").hover();
        await page.waitForTimeout(700); // spring settles at the lifted pose
      },
    },
    {
      category: "motion",
      name: "living-chain-mid-build",
      route: "/evidence",
      viewports: [DESKTOP_VIEWPORT],
      fullPage: false,
      motion: true,
      act: async (page) => {
        // Halfway through the sticky runway: cards 2-3 landing, prevHash chip in flight.
        await page.evaluate(() => {
          const el = document.querySelector("[data-vt-hero]") ?? document.body;
          void el; // anchor lookup kept simple: scroll by absolute page fraction
          window.scrollTo(0, document.body.scrollHeight * 0.42);
        });
        await page.waitForTimeout(1600); // lazy upgrade + springs settle
      },
    },
    {
      category: "motion",
      name: "living-chain-verdict",
      route: "/evidence",
      viewports: [DESKTOP_VIEWPORT],
      fullPage: false,
      motion: true,
      act: async (page) => {
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight * 0.58),
        );
        await page.waitForTimeout(1600); // verdict stamp + seal tick settle
      },
    },
  ];
}

export function parseArgs(argv: readonly string[]): {
  baseUrl: string;
  outDir: string;
  prod: boolean;
  only: string | null;
  match: RegExp | null;
} {
  let baseUrl = "http://localhost:3030"; // apps/site's `dev`/`start` scripts both pin -p 3030
  let outDir = "";
  let prod = false;
  let only: string | null = null;
  let match: RegExp | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base-url" && argv[i + 1]) baseUrl = String(argv[++i]);
    else if (argv[i] === "--out" && argv[i + 1]) outDir = String(argv[++i]);
    else if (argv[i] === "--prod") prod = true;
    else if (argv[i] === "--only" && argv[i + 1]) only = String(argv[++i]);
    else if (argv[i] === "--match" && argv[i + 1])
      match = new RegExp(String(argv[++i]));
  }
  if (prod) baseUrl = "https://caisson.sh";
  if (outDir === "") {
    const stamp = new Date().toISOString().slice(0, 10);
    outDir = `outputs/visual-audit/${stamp}`;
  }
  return { baseUrl, outDir, prod, only, match };
}

const NAV_TIMEOUT = 30_000; // a cold edge + CF Access hop can be slow on the first hit

async function shootOne(
  browser: Browser,
  opts: {
    baseUrl: string;
    outDir: string;
    shot: Shot;
    viewport: Viewport;
    mode: "light" | "dark";
    extraHTTPHeaders?: Record<string, string>;
  },
): Promise<ShotResult> {
  const { baseUrl, outDir, shot, viewport, mode } = opts;
  const file = join(
    outDir,
    shot.category,
    `${shot.name}__${viewport.name}__${mode}.png`,
  );
  const base: ShotResult = {
    category: shot.category,
    name: shot.name,
    route: shot.route,
    viewport: viewport.name,
    mode,
    file,
    ok: false,
  };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: mode,
    // Deterministic screenshots — a scroll-reveal mid-animation would make two runs of the same
    // route diff for no reason. The site already honors prefers-reduced-motion (shows final state).
    // Motion-leg shots (ADR-0334) opt OUT to capture the real transition states.
    reducedMotion: shot.motion ? "no-preference" : "reduce",
    ...(opts.extraHTTPHeaders
      ? { extraHTTPHeaders: opts.extraHTTPHeaders }
      : {}),
  });
  await context.addInitScript((theme) => {
    window.localStorage.setItem("cs-theme", theme);
  }, mode);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Same origin-scoped drop as prod-routes.live.test.ts's THIRD_PARTY_CONSOLE_SOURCES:
    // Turnstile's challenge platform logs deliberate console noise (incl. the hidden
    // "%c%d"/NaN fingerprinting probe) from its own frames — third-party by source URL,
    // never keyed on message text. ADR-0376: the whole console-NaN audit family was this.
    if (/^https:\/\/challenges\.cloudflare\.com\//.test(msg.location().url))
      return;
    consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  try {
    if (shot.html !== undefined) {
      // Email leg: render from a temp HTML file so relative behavior matches a real client-ish load.
      const htmlFile = join(
        outDir,
        shot.category,
        `_html`,
        `${shot.name}.html`,
      );
      await Bun.write(htmlFile, shot.html);
      await page.goto(`file://${resolve(htmlFile)}`, { waitUntil: "load" });
    } else if (shot.route !== undefined) {
      // "load" not "networkidle" — a persistent connection (analytics beacon, HMR) never lets
      // networkidle fire and the nav times out even though the page rendered fine long ago.
      // One retry: a cold start / CF hop occasionally blows the first nav's budget.
      let res = await page
        .goto(`${baseUrl}${shot.route}`, {
          waitUntil: "load",
          timeout: NAV_TIMEOUT,
        })
        .catch(() => null);
      if (res === null) {
        res = await page.goto(`${baseUrl}${shot.route}`, {
          waitUntil: "load",
          timeout: NAV_TIMEOUT,
        });
      }
      if (!res || !res.ok())
        throw new Error(`HTTP ${res?.status() ?? "no response"}`);
      if (new URL(page.url()).hostname.endsWith(".cloudflareaccess.com"))
        throw new Error("bounced to the Cloudflare Access interstitial");
      await page.evaluate((theme) => {
        document.documentElement.setAttribute("data-theme", theme);
      }, mode);
    } else {
      throw new Error("shot has neither route nor html");
    }
    await page.waitForTimeout(400); // let the theme repaint + any reveal-on-scroll settle
    if (shot.act) await shot.act(page);
    await page.screenshot({ path: file, fullPage: shot.fullPage ?? true });
    return {
      ...base,
      ok: true,
      ...(consoleErrors.length > 0 ? { consoleErrors } : {}),
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
      ...(consoleErrors.length > 0 ? { consoleErrors } : {}),
    };
  } finally {
    await context.close();
  }
}

async function asyncPool<T, R>(
  limit: number,
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i] as T);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const { baseUrl, outDir, prod, only, match } = parseArgs(
    process.argv.slice(2),
  );

  let extraHTTPHeaders: Record<string, string> | undefined;
  if (prod) {
    const id = process.env.CAISSON_E2E_CF_CLIENT_ID ?? "";
    const secret = process.env.CAISSON_E2E_CF_CLIENT_SECRET ?? "";
    if (id === "" || secret === "") {
      console.error(
        "--prod needs CAISSON_E2E_CF_CLIENT_ID + CAISSON_E2E_CF_CLIENT_SECRET",
      );
      process.exitCode = 1;
      return;
    }
    extraHTTPHeaders = {
      "CF-Access-Client-Id": id,
      "CF-Access-Client-Secret": secret,
    };
  }

  const shots: Shot[] = [
    // Same source as allRoutes() — see pageShotGroups(). Every route the tests assert on is
    // therefore a route this run actually shoots, rather than a route a parallel list happens to
    // agree about.
    ...pageShotGroups().flatMap((group) =>
      pageShots(group.category, group.routes),
    ),
    // Card-viewer pop-outs: every bundle (the `everything` bundle has NO standalone page — the
    // pop-out is its only surface) + every module's pop-out variant.
    ...BUNDLE_PAGES.map((b): Shot => ({
      category: "popout",
      name: `bundle-${b.slug}`,
      route: `/marketplace?view=bundle:${b.slug}`,
      fullPage: false,
    })),
    ...MODULE_PAGES.map((m): Shot => ({
      category: "popout",
      name: `module-${m.slug}`,
      route: `/marketplace?view=module:${m.slug}`,
      fullPage: false,
    })),
    ...(await emailShots()),
    ...interactionShots(),
    ...motionShots(),
  ]
    .filter((s) => only === null || s.category === only)
    .filter((s) => match === null || match.test(`${s.category}/${s.name}`));

  const categories = [...new Set(shots.map((s) => s.category))];
  for (const c of categories)
    await mkdir(join(outDir, c, "_html"), { recursive: true });

  const browser = await chromium.launch();
  const results: ShotResult[] = [];
  try {
    const jobs: Array<{
      shot: Shot;
      viewport: Viewport;
      mode: "light" | "dark";
    }> = [];
    for (const shot of shots) {
      for (const viewport of shot.viewports ?? VIEWPORTS)
        for (const mode of MODES) jobs.push({ shot, viewport, mode });
    }

    console.log(
      `visual-harness: ${shots.length} surfaces → ${jobs.length} screenshots (${categories.join(", ")}) -> ${outDir}`,
    );

    const shotResults = await asyncPool(
      4,
      jobs,
      async ({ shot, viewport, mode }) => {
        const r = await shootOne(browser, {
          baseUrl,
          outDir,
          shot,
          viewport,
          mode,
          ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
        });
        console.log(
          `${r.ok ? "ok  " : "FAIL"} [${r.category}] ${r.name} ${r.viewport}/${r.mode}${r.ok ? "" : ` — ${r.error}`}`,
        );
        return r;
      },
    );
    results.push(...shotResults);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok && r.skipped === undefined);
  const withConsoleErrors = results.filter(
    (r) => (r.consoleErrors?.length ?? 0) > 0,
  );
  console.log(
    `visual-harness: ${results.length - failed.length}/${results.length} succeeded` +
      (failed.length > 0 ? `, ${failed.length} FAILED` : "") +
      (withConsoleErrors.length > 0
        ? `, ${withConsoleErrors.length} shots logged console errors`
        : ""),
  );
  // Merge into an existing manifest (a --only/--match re-run patches its subset, never clobbers
  // the rest of the run directory's record).
  const manifestPath = join(outDir, "manifest.json");
  const keyOf = (r: ShotResult) =>
    `${r.category}/${r.name}/${r.viewport}/${r.mode}`;
  const prior = (await Bun.file(manifestPath)
    .json()
    .catch(() => [])) as ShotResult[];
  const merged = new Map(prior.map((r) => [keyOf(r), r]));
  for (const r of results) merged.set(keyOf(r), r);
  await Bun.write(manifestPath, JSON.stringify([...merged.values()], null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

// Guard execution so `bun test` can import routeSlug/parseArgs/allRoutes without launching a
// real browser sweep — only run when this file is the entry point.
if (import.meta.main) {
  await main();
}
