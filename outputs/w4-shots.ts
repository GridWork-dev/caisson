// W4 proof shots — own chromium, never the shared MCP browser. Run from apps/site:
//   bun run ../../outputs/w4-shots.ts
import { chromium } from "playwright";

const BASE = "http://localhost:3104";
const OUT = "/home/gw/lab/caisson-wt-g4/outputs/w4-proof";

const DOCS_PAGES = [
  ["shiki-billing", "/docs/base/billing"],
  ["shiki-credits", "/docs/ai-production/credits"],
  ["shiki-kernel", "/docs/base/kernel"],
  ["shiki-compliance-core", "/docs/compliance/compliance-core"],
  ["theta-ai-production", "/docs/ai-production"],
  ["sidebar-kernel", "/docs/base/kernel"],
] as const;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();

for (const [name, path] of DOCS_PAGES) {
  for (const theme of ["light", "dark"] as const) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
    }, theme);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/${name}__${theme}.png`,
      fullPage: true,
    });
  }
}

// eu-ai-act at 390 viewport — overflow check
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${BASE}/frameworks/eu-ai-act`, { waitUntil: "networkidle" });
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth,
);
await mobile.screenshot({
  path: `${OUT}/eu-ai-act-390-after.png`,
  fullPage: true,
});
console.log(`eu-ai-act scrollWidth @390: ${overflow}`);

await browser.close();
console.log("done");
