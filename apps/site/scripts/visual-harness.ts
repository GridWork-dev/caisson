#!/usr/bin/env bun
/**
 * Full-page visual-regression / audit harness for apps/site. Screenshots every public marketing
 * route at mobile + desktop widths, each in light + dark mode, with `fullPage: true` — the
 * viewport WIDTH stays fixed (that's the point: regular device widths) but the screenshot height
 * captures the whole scrollable page, not just the first viewport.
 *
 * Requires a running site (dev or built+started) — this script does not start one itself. Theme is
 * forced via the same mechanism the site uses (`localStorage["cs-theme"]` read by
 * `public/theme-init.js`, which sets `[data-theme]` on `<html>`), with a belt-and-suspenders
 * `data-theme` override after navigation so a slow/cached init script can't leave the wrong mode.
 *
 * Dashboard routes (`/dashboard/*`) are NOT included — they require an authenticated session this
 * harness doesn't establish. `/preview/emails` IS included since it's reachable in dev.
 *
 * Usage:
 *   bun run scripts/visual-harness.ts [--base-url http://localhost:3000] [--out screenshots]
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { MODULE_PAGES } from "../lib/module-pages.ts";
import { GLOSSARY_TERMS } from "../lib/glossary.ts";

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: readonly Viewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

const MODES: readonly ("light" | "dark")[] = ["light", "dark"];

const STATIC_ROUTES: readonly string[] = [
  "/",
  "/compliance",
  "/ai-kit",
  "/local-first",
  "/agentic-dev",
  "/procurement",
  "/changelog",
  "/security",
  "/cart",
  "/marketplace",
  "/marketplace/modules",
  "/marketplace/build",
  "/marketplace/plans",
  "/glossary",
  "/docs",
  "/docs/getting-started",
  "/legal/terms",
  "/legal/privacy",
  "/legal/license",
  "/legal/eula",
  "/frameworks/eu-ai-act",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/preview/emails",
];

export function allRoutes(): readonly string[] {
  return [
    ...STATIC_ROUTES,
    ...MODULE_PAGES.map((m) => `/marketplace/modules/${m.slug}`),
    ...GLOSSARY_TERMS.map((g) => `/glossary/${g.slug}`),
  ];
}

/** Route → filename-safe slug ("/" → "home", strip leading slash, "/" → "__"). */
export function routeSlug(route: string): string {
  if (route === "/") return "home";
  return route.replace(/^\//, "").replace(/\//g, "__");
}

export function parseArgs(argv: readonly string[]): {
  baseUrl: string;
  outDir: string;
} {
  let baseUrl = "http://localhost:3030"; // apps/site's `dev`/`start` scripts both pin -p 3030
  let outDir = "outputs/screenshots"; // matches the existing .gitignore'd local-artifacts convention
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base-url" && argv[i + 1]) baseUrl = String(argv[++i]);
    else if (argv[i] === "--out" && argv[i + 1]) outDir = String(argv[++i]);
  }
  return { baseUrl, outDir };
}

async function shootOne(
  browser: Browser,
  baseUrl: string,
  outDir: string,
  route: string,
  viewport: Viewport,
  mode: "light" | "dark",
): Promise<{
  route: string;
  viewport: string;
  mode: string;
  file: string;
  ok: boolean;
  error?: string;
}> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: mode,
    // Deterministic screenshots — a scroll-reveal mid-animation would make two runs of the same
    // route diff for no reason. The site already honors prefers-reduced-motion (shows final state).
    reducedMotion: "reduce",
  });
  await context.addInitScript((theme) => {
    window.localStorage.setItem("cs-theme", theme);
  }, mode);
  const page = await context.newPage();
  const file = join(
    outDir,
    `${routeSlug(route)}__${viewport.name}__${mode}.png`,
  );
  try {
    // "load" not "networkidle" — a persistent connection (analytics beacon, HMR) never lets
    // networkidle fire and the nav times out even though the page rendered fine long ago.
    const res = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "load",
      timeout: 20_000,
    });
    if (!res || !res.ok()) {
      throw new Error(`HTTP ${res?.status() ?? "no response"}`);
    }
    await page.evaluate((theme) => {
      document.documentElement.setAttribute("data-theme", theme);
    }, mode);
    await page.waitForTimeout(400); // let the theme repaint + any reveal-on-scroll settle
    await page.screenshot({ path: file, fullPage: true });
    return { route, viewport: viewport.name, mode, file, ok: true };
  } catch (err) {
    return {
      route,
      viewport: viewport.name,
      mode,
      file,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const { baseUrl, outDir } = parseArgs(process.argv.slice(2));
  await mkdir(outDir, { recursive: true });

  const routes = allRoutes();
  const total = routes.length * VIEWPORTS.length * MODES.length;
  console.log(
    `visual-harness: ${routes.length} routes × ${VIEWPORTS.length} viewports × ${MODES.length} modes = ${total} screenshots -> ${outDir}`,
  );

  const browser = await chromium.launch();
  const results: Array<Awaited<ReturnType<typeof shootOne>>> = [];
  try {
    for (const route of routes) {
      for (const viewport of VIEWPORTS) {
        for (const mode of MODES) {
          const result = await shootOne(
            browser,
            baseUrl,
            outDir,
            route,
            viewport,
            mode,
          );
          results.push(result);
          console.log(
            `${result.ok ? "ok  " : "FAIL"} ${result.route} ${result.viewport}/${result.mode}${
              result.ok ? "" : ` — ${result.error}`
            }`,
          );
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `visual-harness: ${results.length - failed.length}/${results.length} succeeded` +
      (failed.length > 0 ? `, ${failed.length} FAILED (see above)` : ""),
  );
  await Bun.write(
    join(outDir, "manifest.json"),
    JSON.stringify(results, null, 2),
  );
  if (failed.length > 0) process.exitCode = 1;
}

// Guard execution so `bun test` can import routeSlug/parseArgs/allRoutes without launching a
// real browser sweep — only run when this file is the entry point.
if (import.meta.main) {
  await main();
}
