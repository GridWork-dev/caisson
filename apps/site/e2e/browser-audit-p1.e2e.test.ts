// e2e/browser-audit-p1.e2e.test.ts — the DETERMINISTIC browser-audit graduation suite (ADR-0323
// D2, CAISSON-93). The four P1 clean replays from `outputs/browser-audit/2026-07-10-full-01/`
// pinned as local Playwright tests, so the PR that regresses one fails CI instead of waiting for
// the next advisory audit run. Fixes under pin (all landed in PR #205):
//
//   P1-001  homepage code viewer: the `:global()` id-scope reveal in repo-artifact.module.css —
//           CSS Modules silently hash-scoped the `#repo-artifact-tab-*` id selectors, the
//           `:has()` reveal never matched, every panel stayed display:none, `.codeCard` was 0px.
//   P1-002  /docs skip link: fumadocs' DocsLayout renders no <main>, so `#main-content` had no
//           target and the document no main landmark (docs/layout.tsx wraps children in one).
//   P1-003  marketplace compare: 13x13 checkbox under the card's stretched preview overlay —
//           `.cardCompare` gains z-index:1 + a centered invisible 44x44 `::before` hit area.
//   P1-004  docs search: no trigger rendered Radix's <Dialog.Trigger>, so focus fell to <body>
//           on dismiss — search.tsx captures the opener and restores it via onCloseAutoFocus.
//
// Plus two riders from the CAISSON-93 review: the fumadocs `size-4.5` hit-area hook canary (the
// global.css 44px overlay rides an UNDOCUMENTED third-party class token — a fumadocs bump can
// silently drop it; the canary fails the moment the token disappears or the overlay stops
// computing 44px), and the hit-area overhang pass (adjacent 44px overlays in the nav-utils
// cluster and the media-carousel arrows must not swallow each other's centers at mobile widths).
//
// Unlike `live/` this targets a LOCAL `next start` over the committed build — no env, no CF
// Access, no network beyond localhost — so it runs deterministically on any PR. How to run:
// `bunx turbo run test:e2e --filter=@caisson/site` (builds first via the task's dependsOn), or
// `bun run build && bun run test:e2e` from apps/site.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

const SITE_DIR = join(import.meta.dir, "..");
const PORT = 3947; // not 3030 — never collide with an operator dev server
const BASE_URL = `http://127.0.0.1:${PORT}`;
const NAV_TIMEOUT = 30_000;
const TEST_TIMEOUT = 60_000;

const DESKTOP = { width: 1280, height: 900 } as const;
const MOBILE = { width: 375, height: 800 } as const; // the audit's mobile breakpoint

let server: ReturnType<typeof Bun.spawn> | null = null;
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

describe("browser-audit P1 graduation — deterministic Playwright over a local next start (ADR-0323 D2)", () => {
  beforeAll(async () => {
    const buildId = join(SITE_DIR, ".next", "BUILD_ID");
    if (!existsSync(buildId)) {
      throw new Error(
        "no .next build — run `bunx turbo run build --filter=@caisson/site` first " +
          "(the test:e2e turbo task does this via dependsOn)",
      );
    }
    server = Bun.spawn({
      cmd: ["bunx", "next", "start", "-p", String(PORT)],
      cwd: SITE_DIR,
      stdout: "ignore",
      stderr: "ignore",
    });
    // wait-for-ready: poll until the server answers (30s cap)
    const deadline = Date.now() + 30_000;
    for (;;) {
      try {
        const res = await fetch(`${BASE_URL}/`, {
          signal: AbortSignal.timeout(2_000),
        });
        if (res.ok) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) {
        throw new Error(`next start did not answer on :${PORT} within 30s`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    browser = await chromium.launch();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await browser?.close();
    server?.kill();
    await server?.exited;
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
        await kernelRow.scrollIntoViewIfNeeded();
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
        await rls.scrollIntoViewIfNeeded();
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
        // exactly ONE main landmark (lighthouse `landmark-one-main`), and it IS the skip target
        expect(
          await page.locator("main").count(),
          "docs must render exactly one <main> landmark",
        ).toBe(1);
        expect(
          await page.locator("main#main-content").count(),
          "the main landmark must be the #main-content skip target",
        ).toBe(1);

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
    "P1-003 marketplace compare control: 44px effective target above the stretched preview action",
    async () => {
      const { ctx, page } = await newPage(DESKTOP);
      try {
        await goto(page, "/marketplace");
        const checkbox = page.getByLabel(/^Compare /).first();
        const label = checkbox.locator("xpath=ancestor::label").first();
        await label.scrollIntoViewIfNeeded();

        // the shipped contract: a centered 44x44 ::before hit area (>= the 24px WCAG 2.2 AA
        // floor) and z-index 1 lifting it above the card's inset:0 preview overlay button.
        const contract = await label.evaluate((el) => {
          const before = getComputedStyle(el, "::before");
          return {
            w: before.width,
            h: before.height,
            zIndex: getComputedStyle(el).zIndex,
          };
        });
        expect(contract.w, "compare ::before hit-area width").toBe("44px");
        expect(contract.h, "compare ::before hit-area height").toBe("44px");
        expect(
          contract.zIndex,
          "compare label must stack above the stretched preview action",
        ).toBe("1");

        // every corner of the 24x24 AA box centered on the control resolves to the control —
        // nothing (in particular the stretched preview button) steals the hit.
        const corners = await label.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const cx = r.x + r.width / 2;
          const cy = r.y + r.height / 2;
          return [-12, 12].flatMap((dy) =>
            [-12, 12].map((dx) => {
              const hit = document.elementFromPoint(cx + dx, cy + dy);
              return hit !== null && (hit === el || el.contains(hit));
            }),
          );
        });
        expect(
          corners,
          "a 24x24 AA-box corner is not clickable on the compare control",
        ).toEqual([true, true, true, true]);

        // behavioral proof: a click OUTSIDE the 19px-tall visual label but inside the expanded
        // zone toggles the checkbox and does NOT open the preview viewer or navigate.
        const box = await label.boundingBox();
        if (box === null) throw new Error("compare label has no box");
        const urlBefore = page.url();
        await page.mouse.click(
          box.x + box.width / 2,
          box.y + box.height / 2 - 14,
        );
        await page.waitForTimeout(300);
        expect(
          await checkbox.isChecked(),
          "expanded-zone click did not toggle compare",
        ).toBe(true);
        expect(page.url(), "compare click must not navigate").toBe(urlBefore);
        expect(
          await page.getByLabel("Next slide").count(),
          "compare click must not open the preview viewer",
        ).toBe(0);
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
          // on a neighbor (gap-2 cluster: search/cart/theme/menu) must not swallow it.
          const controls = await page.evaluate(() => {
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
          });
          expect(controls.length).toBeGreaterThan(0);
          const stolen = controls.filter((c) => !c.selfOwned);
          expect(
            stolen,
            `${viewport.width}px header controls whose center a neighbor's hit area steals`,
          ).toEqual([]);

          // the two known 44px overlays in the compact cluster keep their contract
          if (viewport.width === MOBILE.width) {
            for (const name of ["Cart", "Open menu"]) {
              const dims = await page
                .getByLabel(name, { exact: true })
                .first()
                .evaluate((el) => {
                  const before = getComputedStyle(el, "::before");
                  return { w: before.width, h: before.height };
                });
              expect(dims.w, `${name} 44px overlay width`).toBe("44px");
              expect(dims.h, `${name} 44px overlay height`).toBe("44px");
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
        // the carousel lives inside the card preview viewer — open the first card's preview
        const preview = page.getByRole("button", { name: /^Preview / }).first();
        await preview.scrollIntoViewIfNeeded();
        await preview.click({ position: { x: 8, y: 8 } });
        for (const name of ["Previous slide", "Next slide"]) {
          const arrow = page.getByLabel(name, { exact: true }).first();
          await arrow.waitFor({ state: "visible", timeout: 10_000 });
          const info = await arrow.evaluate((el) => {
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
            };
          });
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
