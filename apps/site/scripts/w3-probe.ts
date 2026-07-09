#!/usr/bin/env bun
// W3 remediation probe — before/after screenshots + overflow measurements (local dev on :3103).
// Operator tool, never CI. Usage: bun run scripts/w3-probe.ts <outdir-suffix>
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3103";
const OUT = `/home/gw/lab/caisson-wt-g3/outputs/w3-proof/${process.argv[2] ?? "probe"}`;

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function measure(page: Page, label: string) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const over = m.scrollWidth - m.clientWidth;
  console.log(
    `${label}: scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth}${over > 0 ? ` OVERFLOW +${over}px` : ""}`,
  );
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

async function goto(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(600);
}

async function openPopout(page: Page, viewId: string) {
  await goto(page, `/marketplace?view=${viewId}`);
  await page.waitForSelector("dialog[open]", { timeout: 20000 });
  await page.waitForTimeout(500);
}

const BUNDLE_ROUTES = [
  "compliance",
  "ai-kit",
  "local-first",
  "provenance",
  "agentic-dev",
];
const NEW_DIAGRAM_MODULES = [
  "alerting",
  "ai-meter",
  "ai-evals",
  "guardrails",
  "prompt-registry",
  "local-store",
  "agent-kernel",
  "agent-runner",
];
const CODE_PANEL_MODULES = [
  "field-crypto",
  "guardrails",
  "local-store",
  "prompt-registry",
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

// ---- desktop pass ----
{
  const ctx = await browser.newContext({
    viewport: DESKTOP,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  // 1. bundle depth pages — media slot
  for (const b of BUNDLE_ROUTES) {
    await goto(page, `/${b}`);
    // scroll to the media section (after hero + composes sections)
    await page.waitForTimeout(300);
    const media = page
      .locator("section, div")
      .filter({ has: page.locator('[aria-hidden="true"], [role="img"]') });
    void media;
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    await shot(page, `bundle-${b}-media-desktop`);
  }

  // 2. popouts — new-diagram modules + code panels + ai-meter P0
  for (const m of [
    ...new Set([...NEW_DIAGRAM_MODULES, ...CODE_PANEL_MODULES]),
  ]) {
    await openPopout(page, `module:${m}`);
    await shot(page, `popout-${m}-desktop`);
  }

  // 3. module depth pages carrying new diagrams (media section)
  for (const m of NEW_DIAGRAM_MODULES) {
    await goto(page, `/marketplace/modules/${m}`);
    const section = page.getByRole("heading", { name: "See it work" });
    if ((await section.count()) > 0) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await measure(page, `module-${m}-desktop`);
    await shot(page, `module-${m}-media-desktop`);
  }

  // 4. retention-runner worm-lifecycle overflow
  await goto(page, `/marketplace/modules/retention-runner`);
  const rr = page.getByRole("heading", { name: "See it work" });
  if ((await rr.count()) > 0) await rr.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, "module-retention-runner-media-desktop");

  await ctx.close();
}

// ---- mobile pass ----
{
  const ctx = await browser.newContext({
    viewport: MOBILE,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  // ai-evals 390px overflow measurement
  for (const m of ["ai-evals", ...CODE_PANEL_MODULES]) {
    await goto(page, `/marketplace/modules/${m}`);
    await page.waitForTimeout(400);
    await measure(page, `module-${m}-mobile`);
  }
  await goto(page, `/marketplace/modules/ai-evals`);
  await shot(page, "module-ai-evals-mobile", true);

  // popout mobile: ai-meter (P0) + field-crypto (diagram wider than modal)
  for (const m of [
    "ai-meter",
    "field-crypto",
    "guardrails",
    "local-store",
    "prompt-registry",
  ]) {
    await openPopout(page, `module:${m}`);
    await measure(page, `popout-${m}-mobile`);
    await shot(page, `popout-${m}-mobile`);
  }

  // bundle media mobile
  for (const b of BUNDLE_ROUTES) {
    await goto(page, `/${b}`);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(300);
    await shot(page, `bundle-${b}-media-mobile`);
  }

  await ctx.close();
}

await browser.close();
console.log(`done → ${OUT}`);
