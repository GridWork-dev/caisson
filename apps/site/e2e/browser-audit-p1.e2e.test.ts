// e2e/browser-audit-p1.e2e.test.ts — the DETERMINISTIC browser-audit graduation suite (ADR-0323
// D2, CAISSON-93). The P1 clean replays from `outputs/browser-audit/2026-07-10-full-01/`
// pinned as local Playwright tests, so the PR that regresses one fails CI instead of waiting for
// the next advisory audit run. Fixes under pin (all landed in PR #205):
//
//   P1-001  homepage code viewer: the `:global()` id-scope reveal in repo-artifact.module.css —
//           CSS Modules silently hash-scoped the `#repo-artifact-tab-*` id selectors, the
//           `:has()` reveal never matched, every panel stayed display:none, `.codeCard` was 0px.
//   P1-002  /docs skip link: fumadocs' DocsLayout renders no <main>, so `#main-content` had no
//           target and the document no main landmark (docs/layout.tsx wraps children in one).
//   (P1-003, the marketplace compare control, retired with the control itself — ADR-0428 L10.)
//   P1-004  docs search: no trigger rendered Radix's <Dialog.Trigger>, so focus fell to <body>
//           on dismiss — search.tsx captures the opener and restores it via onCloseAutoFocus.
//
// Plus two riders from the CAISSON-93 review: the fumadocs `size-4.5` hit-area hook canary (the
// global.css 44px overlay rides an UNDOCUMENTED third-party class token — a fumadocs bump can
// silently drop it; the canary fails the moment the token disappears or the overlay stops
// computing 44px), and the hit-area overhang pass (adjacent 44px overlays in the nav-utils
// cluster and the media-carousel arrows must not swallow each other's centers at mobile widths).
//
// Unlike `live/` this targets a LOCAL static server over the exported `out/` directory — no CF
// Access and no network beyond localhost — so it runs deterministically on any PR. How to run:
// `bunx turbo run test:e2e --filter=@caisson-sh/site` (builds first via the task's dependsOn), or
// `bun run build && bun run test:e2e` from apps/site.
//
// Third-party coupling, named: besides the size-4.5 canary (deliberate), P1-004 rides two
// fumadocs surfaces — the `data-search-full` attribute on the expanded-sidebar search toggle and
// the "Close Search" accessible name on the dialog's close control. A fumadocs bump that renames
// either breaks that test with a locator timeout, not a product regression; re-anchor there.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";

const SITE_DIR = join(import.meta.dir, "..");
const PORT = 3947; // not 3030 — never collide with an operator dev server
const BASE_URL = `http://127.0.0.1:${PORT}`;
const NAV_TIMEOUT = 30_000;
const TEST_TIMEOUT = 60_000;
const OUT_DIR = join(SITE_DIR, "out");

const DESKTOP = { width: 1280, height: 900 } as const;
const MOBILE = { width: 375, height: 800 } as const; // the audit's mobile breakpoint

let server: ReturnType<typeof Bun.serve> | null = null;
let browser: Browser | null = null;

async function newPage(viewport: {
  width: number;
  height: number;
}): Promise<{ ctx: BrowserContext; page: Page }> {
  if (browser === null) throw new Error("browser not initialized");
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function goto(page: Page, path: string): Promise<void> {
  // "load" not "networkidle" — same gotcha as the live sweep: a persistent analytics
  // connection never lets networkidle fire even though the page rendered long ago.
  const res = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "load",
    timeout: NAV_TIMEOUT,
  });
  if (res === null) throw new Error(`${path}: no navigation response`);
  expect(res.status(), `${path}: HTTP ${res.status()}`).toBeLessThan(400);
}

/** The static export's file for a request path, the way the Cloudflare asset handler resolves it
 *  (`/x` → `x`, `x.html`, or `x/index.html`), or the 404 page. Paths are normalized and must stay
 *  under OUT_DIR. */
function exportedFile(pathname: string): { file: string; status: number } {
  const base = join(OUT_DIR, normalize(decodeURIComponent(pathname)));
  if (base.startsWith(OUT_DIR)) {
    for (const candidate of [base, `${base}.html`, join(base, "index.html")]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return { file: candidate, status: 200 };
      }
    }
  }
  return { file: join(OUT_DIR, "404.html"), status: 404 };
}

/** scrollIntoViewIfNeeded with a detach retry: client surfaces (marketplace grid, homepage)
 *  re-render as React hydrates, and on a slow runner a locator resolved pre-hydration can
 *  detach before the scroll lands — Playwright throws "Element is not attached to the DOM"
 *  instead of re-resolving. Retrying re-resolves the locator against the hydrated tree. */
async function scrollWhenStable(target: Locator): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await target.scrollIntoViewIfNeeded({ timeout: 5_000 });
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Bounded retry around a geometry-reading evaluate(): `goto`'s "load" resolves on the load
 *  event, which fires before the browser guarantees the next paint — on a slow CI runner an
 *  evaluate() that runs immediately after can read getBoundingClientRect() as 0x0 for every
 *  element, and a width/height filter or hit-test built on those 0x0 rects drops everything.
 *  Proven flake: two consecutive main-branch runs hit `controls.length === 0` on
 *  byte-identical code on 2026-07-11 (GitHub Actions runs 29159973533 / 29160396237), then a
 *  third run passed. `isUnpainted` names the caller's own "still reading pre-paint geometry"
 *  signal; retries a capped few times with a small backoff to give the browser another
 *  animation-frame tick, then returns the last result and lets the existing assertions fail
 *  loudly — this masks the paint race, it never masks a real post-paint failure. */
async function evaluateAfterPaint<T>(
  run: () => Promise<T>,
  isUnpainted: (result: T) => boolean,
): Promise<T> {
  let result = await run();
  for (let attempt = 0; isUnpainted(result) && attempt < 4; attempt += 1) {
    await new Promise((r) => setTimeout(r, 500));
    result = await run();
  }
  return result;
}

describe("browser-audit P1 graduation — deterministic Playwright over a local next start (ADR-0323 D2)", () => {
  beforeAll(async () => {
    if (!existsSync(join(OUT_DIR, "index.html"))) {
      throw new Error(
        "no static export — run `bunx turbo run build --filter=@caisson-sh/site` first " +
          "(the test:e2e turbo task does this via dependsOn)",
      );
    }
    server = Bun.serve({
      port: PORT,
      hostname: "127.0.0.1",
      fetch(req) {
        const { file, status } = exportedFile(new URL(req.url).pathname);
        return new Response(Bun.file(file), { status });
      },
    });
    browser = await chromium.launch();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await browser?.close();
    await server?.stop(true);
  });

  test(
    "P1-001 homepage code viewer renders non-zero and swaps panels (desktop)",
    async () => {
      const { ctx, page } = await newPage(DESKTOP);
      try {
        await goto(page, "/");
        // default selection is `rls` (DEFAULT_CODE_ID in repo-artifact.tsx) — the panel must be
        // visible with real height. The regression class collapsed it to 720x0 / 342x0.
        const rls = page.locator('[data-card-id="rls"]');
        await rls.waitFor({ state: "visible", timeout: 10_000 });
        const rlsBox = await rls.boundingBox();
        expect(rlsBox, "rls panel has no box").not.toBeNull();
        expect(
          rlsBox?.height ?? 0,
          "rls code panel collapsed (the P1-001 zero-height class)",
        ).toBeGreaterThan(100);

        // selection change is an observable state swap: click the kernel tree row, the kernel
        // panel replaces the rls panel (the `:has(:global(#id):checked)` reveal chain).
        const kernelRow = page.locator("label:has(#repo-artifact-tab-kernel)");
        await scrollWhenStable(kernelRow);
        await kernelRow.click();
        const kernel = page.locator('[data-card-id="kernel"]');
        await kernel.waitFor({ state: "visible", timeout: 5_000 });
        expect(
          (await kernel.boundingBox())?.height ?? 0,
          "kernel panel not revealed after selection",
        ).toBeGreaterThan(100);
        expect(
          await rls.isVisible(),
          "rls panel still visible after selecting kernel",
        ).toBe(false);
      } finally {
        await ctx.close();
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "P1-001 homepage code viewer renders non-zero (mobile)",
    async () => {
      const { ctx, page } = await newPage(MOBILE);
      try {
        await goto(page, "/");
        const rls = page.locator('[data-card-id="rls"]');
        await scrollWhenStable(rls);
        await rls.waitFor({ state: "visible", timeout: 10_000 });
        expect(
          (await rls.boundingBox())?.height ?? 0,
          "rls code panel collapsed at the mobile breakpoint",
        ).toBeGreaterThan(100);
      } finally {
        await ctx.close();
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "P1-002 /docs has one main landmark and the skip link moves focus to it",
    async () => {
      const { ctx, page } = await newPage(DESKTOP);
      try {
        await goto(page, "/docs");
        // exactly ONE main landmark (lighthouse `landmark-one-main`), and it IS the skip target.
        // `main, [role="main"]`, not bare `main` (ADR-0374 W1): docs/[[...slug]]/page.tsx passes
        // `role="main"` onto fumadocs' own `<article>` rather than wrapping it in a literal
        // `<main>` (a wrapper there breaks fumadocs' CSS Grid `[grid-area:*]` layout — the P0 this
        // wave fixed). Every OTHER route group still renders a literal `<main id="main-content">`
        // with no `role` attribute, so the two arms of this selector never both match on any one
        // page — no double-count risk.
        const mainLandmark = page.locator('main, [role="main"]');
        expect(
          await mainLandmark.count(),
          "docs must render exactly one main landmark",
        ).toBe(1);
        expect(
          await mainLandmark.first().getAttribute("id"),
          "the main landmark must be the #main-content skip target",
        ).toBe("main-content");

        // the skip link is the document's FIRST focusable, and activating it moves focus (not
        // just the hash) — `tabIndex={-1}` on the landmark makes it the fragment focus target.
        await page.keyboard.press("Tab");
        const first = await page.evaluate(() => ({
          href: document.activeElement?.getAttribute("href") ?? null,
        }));
        expect(first.href, "first Tab must land on the skip link").toBe(
          "#main-content",
        );
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
        const focused = await page.evaluate(
          () => document.activeElement?.id ?? "",
        );
        expect(
          focused,
          "activating the skip link must move focus to #main-content",
        ).toBe("main-content");
      } finally {
        await ctx.close();
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "P1-004 docs search returns focus to its trigger on every dismissal path",
    async () => {
      const { ctx, page } = await newPage(DESKTOP);
      try {
        await goto(page, "/docs");
        // fumadocs' expanded-sidebar search box — `data-search-full` is fumadocs' own hook for
        // the large toggle, the one operable trigger at this viewport.
        const trigger = page.locator("button[data-search-full]").first();
        await trigger.waitFor({ state: "visible", timeout: 10_000 });

        // path 1: Escape
        await trigger.click();
        const dialog = page.locator('[role="dialog"]');
        await dialog.waitFor({ state: "visible", timeout: 5_000 });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden", timeout: 5_000 });
        expect(
          await trigger.evaluate((el) => el === document.activeElement),
          "Escape must return focus to the search trigger (not <body>)",
        ).toBe(true);

        // path 2: the close button (both paths funnel through onCloseAutoFocus — this pins the
        // restore for click-dismissal too)
        await trigger.click();
        await dialog.waitFor({ state: "visible", timeout: 5_000 });
        await page.getByRole("button", { name: "Close Search" }).click();
        await dialog.waitFor({ state: "hidden", timeout: 5_000 });
        expect(
          await trigger.evaluate((el) => el === document.activeElement),
          "the close button must return focus to the search trigger",
        ).toBe(true);
      } finally {
        await ctx.close();
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "size-4.5 canary: the fumadocs hit-area hook still matches and computes 44px",
    async () => {
      const { ctx, page } = await newPage(DESKTOP);
      try {
        await goto(page, "/docs");
        // global.css's docs-chrome 44px pass rides fumadocs' compiled `[&_svg]:size-4.5` class
        // token — undocumented third-party surface. Zero matches = a fumadocs bump silently
        // dropped the token and the docs chrome lost its 44px zones: fail loudly here.
        const hooks = await page.evaluate(() => {
          const els = Array.from(
            document.querySelectorAll('[class*="size-4.5"]'),
          );
          return els.map((el) => {
            const before = getComputedStyle(el, "::before");
            return {
              position: getComputedStyle(el).position,
              w: before.width,
              h: before.height,
            };
          });
        });
        expect(
          hooks.length,
          "fumadocs no longer emits the size-4.5 class token — the global.css 44px " +
            "hit-area hook (docs search/sidebar/GitHub chrome) is dead; re-anchor it",
        ).toBeGreaterThanOrEqual(1);
        for (const h of hooks) {
          expect(
            h.position,
            "hook target must be the ::before containing block",
          ).toBe("relative");
          expect(h.w, "hook ::before width").toBe("44px");
          expect(h.h, "hook ::before height").toBe("44px");
        }
      } finally {
        await ctx.close();
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "hit-area overhang: nav-utils cluster centers stay self-owned (desktop + mobile)",
    async () => {
      for (const viewport of [DESKTOP, MOBILE]) {
        const { ctx, page } = await newPage(viewport);
        try {
          await goto(page, "/");
          // every visible header control's center must hit ITSELF — an expanded 44px ::before
          // on a neighbor (gap-2 cluster: search/theme/menu) must not swallow it.
          const controls = await evaluateAfterPaint(
            () =>
              page.evaluate(() => {
                const els = Array.from(
                  document.querySelectorAll("header button, header a[href]"),
                ).filter((el) => {
                  const r = el.getBoundingClientRect();
                  return (
                    r.width > 0 &&
                    r.height > 0 &&
                    r.y >= 0 &&
                    r.x >= 0 &&
                    r.bottom <= window.innerHeight &&
                    r.right <= window.innerWidth
                  );
                });
                return els.map((el) => {
                  const r = el.getBoundingClientRect();
                  const hit = document.elementFromPoint(
                    r.x + r.width / 2,
                    r.y + r.height / 2,
                  );
                  return {
                    name:
                      el.getAttribute("aria-label") ??
                      el.textContent?.trim().slice(0, 20) ??
                      el.tagName,
                    selfOwned: hit !== null && (hit === el || el.contains(hit)),
                  };
                });
              }),
            // pre-paint every header control's rect is 0x0, so the width/height filter above
            // drops all of them — an empty array IS the "still pre-paint" signal here.
            (r) => r.length === 0,
          );
          expect(controls.length).toBeGreaterThan(0);
          const stolen = controls.filter((c) => !c.selfOwned);
          expect(
            stolen,
            `${viewport.width}px header controls whose center a neighbor's hit area steals`,
          ).toEqual([]);

          // the known 44px overlay in the compact cluster keeps its contract. Assert on the
          // VISIBLE instance only — computed pseudo styles resolve on hidden nodes too, so an
          // unscoped .first() could pin the wrong control.
          if (viewport.width === MOBILE.width) {
            for (const name of ["Open menu"]) {
              const instances = await page
                .getByLabel(name, { exact: true })
                .all();
              let visibleChecked = 0;
              for (const instance of instances) {
                if ((await instance.boundingBox()) === null) continue;
                const dims = await instance.evaluate((el) => {
                  const before = getComputedStyle(el, "::before");
                  return { w: before.width, h: before.height };
                });
                expect(dims.w, `${name} 44px overlay width`).toBe("44px");
                expect(dims.h, `${name} 44px overlay height`).toBe("44px");
                visibleChecked += 1;
              }
              expect(
                visibleChecked,
                `no visible "${name}" control found in the compact cluster`,
              ).toBeGreaterThan(0);
            }
          }
        } finally {
          await ctx.close();
        }
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "hit-area overhang: media-carousel arrows keep 44px self-owned targets at mobile width",
    async () => {
      const { ctx, page } = await newPage(MOBILE);
      try {
        await goto(page, "/marketplace");
        // the carousel lives inside the card preview viewer. Open the Compliance bundle's
        // preview — its media manifest carries a composition diagram + targeted diagrams, so it
        // is deterministically multi-slide (arrows only render past one slide). Enter-activate
        // the stretched overlay button: no click geometry to go stale under a card redesign.
        const preview = page
          .getByRole("button", { name: /^Preview Compliance/ })
          .first();
        await scrollWhenStable(preview);
        await preview.focus();
        await preview.press("Enter");
        // precondition, asserted loudly: if the catalog/media manifest ever trims Compliance to
        // a single slide, fail with THIS message instead of an opaque arrow-locator timeout —
        // the fix is to point the test at another multi-slide entry. Scoped to the carousel:
        // the marketplace filter toolbar carries its own (collapsed-on-mobile) role="group".
        //
        // COMPOUND, not descendant: media-carousel puts role="group" and aria-roledescription on
        // the SAME element. The descendant form this replaces only ever matched because slide 1
        // was a poke that carried its own role="group" — so it was passing on the poke's markup
        // while claiming to check the carousel's. ADR-0400 moved that markup into an iframe
        // document and the accident stopped working.
        await page
          .locator('[aria-roledescription="carousel"][role="group"]')
          .first()
          .waitFor({ state: "visible", timeout: 10_000 })
          .catch(() => {
            throw new Error(
              "the Compliance preview no longer renders a multi-slide carousel — " +
                "re-point this test at a multi-slide catalog entry",
            );
          });
        for (const name of ["Previous slide", "Next slide"]) {
          const arrow = page.getByLabel(name, { exact: true }).first();
          await arrow.waitFor({ state: "visible", timeout: 10_000 });
          const info = await evaluateAfterPaint(
            () =>
              arrow.evaluate((el) => {
                const before = getComputedStyle(el, "::before");
                const r = el.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                );
                return {
                  w: before.width,
                  h: before.height,
                  selfOwned: hit !== null && (hit === el || el.contains(hit)),
                  rectEmpty: r.width === 0 || r.height === 0,
                };
              }),
            // same race, one carousel-open frame later: a 0x0 rect means the hit-test above
            // was built on pre-paint geometry, so selfOwned isn't trustworthy yet.
            (r) => r.rectEmpty,
          );
          expect(info.w, `${name} 44px overlay width`).toBe("44px");
          expect(info.h, `${name} 44px overlay height`).toBe("44px");
          expect(
            info.selfOwned,
            `${name} center is swallowed by an overlapping control`,
          ).toBe(true);
        }
      } finally {
        await ctx.close();
      }
    },
    TEST_TIMEOUT,
  );
});
