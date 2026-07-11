// W4 final verification — P3 riders + shiki dark + theta + changed docs pages.
// Own chromium, never the shared MCP browser. Run from apps/site: bun run ../../outputs/w4-verify.ts
import { chromium } from "playwright";

const BASE = "http://localhost:3104";
const OUT = "/home/gw/lab/caisson-wt-g4/outputs/w4-proof";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();

// 1. Sidebar bundle links on a base-package detail page
await page.goto(`${BASE}/docs/base/kernel`, { waitUntil: "networkidle" });
const sidebarLinks = await page.evaluate(() => {
  const links = Array.from(
    document.querySelectorAll("aside a[href^='/docs/']"),
  ).map((a) => a.getAttribute("href"));
  return links;
});
const bundles = [
  "/docs/compliance",
  "/docs/ai-production",
  "/docs/local-first",
  "/docs/agentic-dev",
  "/docs/provenance",
  "/docs/everything",
];
for (const b of bundles) {
  const present = sidebarLinks.some((l) => l === b || l?.startsWith(b));
  console.log(`sidebar ${b}: ${present ? "PRESENT" : "MISSING"}`);
}

// 2. Kernel pagination link casing
const pagination = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a"))
    .filter((a) => a.getAttribute("href")?.startsWith("/docs/"))
    .slice(-6)
    .map(
      (a) =>
        `${a.getAttribute("href")} :: ${a.textContent?.trim().slice(0, 60)}`,
    ),
);
console.log("kernel tail links:", JSON.stringify(pagination, null, 1));

// 3. Shiki dark on the two pages this session's commit touched + theta page
for (const [name, path] of [
  ["auditworm", "/docs/provenance/audit-worm"],
  ["signing", "/docs/provenance/signing-primitive"],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
    }, theme);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${OUT}/final-${name}__${theme}.png`,
      fullPage: false,
    });
  }
}

// 4. Theta check: the 402 in kernel dark — dump the rendered text of the contract list
await page.goto(`${BASE}/docs/base/kernel`, { waitUntil: "networkidle" });
const has402 = await page.evaluate(() =>
  document.body.textContent?.includes("402"),
);
console.log(`kernel page contains literal 402 text: ${String(has402)}`);

await browser.close();
console.log("done");
