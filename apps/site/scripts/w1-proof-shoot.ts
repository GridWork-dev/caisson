#!/usr/bin/env bun
// W1 proof shots — local playwright, own browser instance (no shared MCP).
// Screenshots the remediated surfaces at 390px + desktop and asserts the
// no-horizontal-page-scroll exit criteria + h1 counts.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3101";
const OUT = "/home/gw/lab/caisson-wt-g1/outputs/w1-proof";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const failures: string[] = [];

async function shot(
  route: string,
  name: string,
  width: number,
  opts: {
    dark?: boolean;
    fullPage?: boolean;
    scrollBottom?: boolean;
    interact?: (page: Page) => Promise<void>;
  } = {},
) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    colorScheme: opts.dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1200);
  if (opts.interact) await opts.interact(page);
  if (opts.scrollBottom) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
  }
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    h1Count: document.querySelectorAll("h1").length,
  }));
  if (metrics.scrollWidth > metrics.innerWidth) {
    failures.push(
      `${route} @${width}px: page scrollWidth ${metrics.scrollWidth} > viewport ${metrics.innerWidth}`,
    );
  }
  if (metrics.h1Count !== 1) {
    failures.push(`${route} @${width}px: h1 count ${metrics.h1Count} (want 1)`);
  }
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: opts.fullPage ?? false,
  });
  console.log(
    `${name}: scrollWidth=${metrics.scrollWidth} viewport=${metrics.innerWidth} h1=${metrics.h1Count}`,
  );
  await ctx.close();
}

// Home — CAISSON-67 exit: exactly viewport-wide at 390, both themes.
await shot("/", "home-390-light", 390, { fullPage: true });
await shot("/", "home-390-dark", 390, { dark: true, fullPage: true });
await shot("/", "home-1280", 1280, { fullPage: true });

// Footer — CAISSON-65: single-column stack at 390 (bottom of home).
await shot("/", "footer-390", 390, { scrollBottom: true });

// Compare template — CAISSON-66.
await shot("/compare/shipfast", "compare-390", 390, { fullPage: true });
await shot("/compare/shipfast", "compare-1280", 1280, { fullPage: true });

// Marketplace — cart bar absent at rest; present after selecting a module.
await shot("/marketplace", "marketplace-390-rest", 390, {
  scrollBottom: true,
});
// The StackBuilder (mobile cart bar) lives on the home page (D4c embed).
await shot("/", "stack-builder-390-selected", 390, {
  interact: async (page) => {
    const box = page
      .locator("label[class*='pickerRow'] input[type=checkbox]")
      .first();
    await box.scrollIntoViewIfNeeded();
    await box.dispatchEvent("click");
    await page.waitForTimeout(400);
  },
});

// Legal measure.
await shot("/legal/terms", "legal-terms-1280", 1280);
await shot("/legal/eula", "legal-eula-1280", 1280);

// Build-vs-buy two-up.
await shot("/build-vs-buy", "build-vs-buy-390", 390, { fullPage: true });

// Forgot-password footer Discord parity (dev server started with the invite env set).
await shot("/forgot-password", "forgot-password-390-footer", 390, {
  scrollBottom: true,
});

// Glossary h1 check rides the shot's h1 assertion.
await shot("/glossary", "glossary-1280", 1280);

// Marketplace card eyebrow at desktop 2-col width.
await shot("/marketplace", "marketplace-1280", 1280);

await browser.close();
if (failures.length > 0) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ALL EXIT CRITERIA PASS");
