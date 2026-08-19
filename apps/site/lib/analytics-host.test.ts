// Guard for the origin gate that makes build-time key inlining harmless. The failure this pins is
// asymmetric, so both directions are asserted: too narrow an allowlist silently blinds real
// traffic (dropping `www` would lose every visitor who typed it), too wide a one lets localhost
// and preview builds pollute caisson-prod.
import { expect, test } from "bun:test";
import { SITE_URL } from "./metadata";
import {
  PRODUCTION_ANALYTICS_HOSTS,
  isProductionAnalyticsHost,
} from "./analytics-host";

test("both hosts the production site actually serves are allowed", () => {
  // Not hardcoded strings: this derives from the same SITE_URL the canonical/meta tags use, so a
  // domain change moves both together instead of leaving telemetry pointed at the old host.
  const apex = new URL(SITE_URL).host;
  expect(PRODUCTION_ANALYTICS_HOSTS).toEqual([apex, `www.${apex}`]);
  expect(isProductionAnalyticsHost(apex)).toBe(true);
  expect(isProductionAnalyticsHost(`www.${apex}`)).toBe(true);
});

test("dev, preview, and lookalike hosts are rejected", () => {
  for (const host of [
    "localhost:3000",
    "127.0.0.1:3000",
    "caisson.sh:3000", // right name, dev port — a local `next start` must not report
    "caisson-site-pr-412.up.railway.app",
    "caisson.sh.evil.test", // suffix lookalike
    "notcaisson.sh",
    "",
  ]) {
    expect(isProductionAnalyticsHost(host)).toBe(false);
  }
});

test("an absent host (non-browser render) is rejected rather than defaulting on", () => {
  expect(isProductionAnalyticsHost(undefined)).toBe(false);
});

// --- the guard that keeps the gate load-bearing -------------------------------------------------
// The origin gate only helps while every sender routes through it. This is the "grep every caller"
// check made permanent: a third analytics sender added later that reads the inlined key and forgets
// the gate would silently reopen the exact pollution this fixes, and no other test would notice.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY_READ = "process.env.NEXT_PUBLIC_POSTHOG_KEY";
const SKIP_DIRS = new Set([
  ".next",
  "node_modules",
  "live",
  "content",
  "public",
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      out.push(full);
  }
  return out;
}

test("every non-test file that reads the inlined PostHog key is origin-gated", () => {
  const files = sourceFiles(SITE_ROOT);
  // Guard the guard: a broken walk (or a rename of the env var) would otherwise scan nothing and
  // pass by vacuity — the failure mode that makes set guards worthless.
  expect(files.length).toBeGreaterThan(100);

  const readers = files.filter((f) =>
    readFileSync(f, "utf8").includes(KEY_READ),
  );
  expect(readers.length).toBeGreaterThan(0);

  const ungated = readers
    .filter(
      (f) => !readFileSync(f, "utf8").includes("isProductionAnalyticsHost"),
    )
    .map((f) => relative(SITE_ROOT, f));
  expect(ungated).toEqual([]);
});
