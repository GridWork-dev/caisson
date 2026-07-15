#!/usr/bin/env bun
/**
 * First-Load-JS + lazy-chunk gzip measurement over a completed `next build` (ADR-0334 §7
 * evidence contract; re-measures the ADR-0306/0309 ≤130 KiB home ceiling).
 *
 * Next 16's Turbopack build prints no route-size table, so the ceiling is asserted from the
 * build output itself: the prerendered route HTML names exactly the scripts a first paint
 * downloads (script[src] + link[rel=preload/modulepreload] under /_next/static/), and each is
 * gzipped here at level 9 — the same order of compression the CDN applies. Lazy chunks (motion,
 * hero field) never appear in the HTML, so they never count toward first load; `--grep` sums
 * the built chunks containing a marker string (e.g. "framer-motion") against their own ceiling.
 *
 * Usage (from apps/site, after `next build`):
 *   bun run scripts/measure-first-load.ts                 # home route first-load table
 *   bun run scripts/measure-first-load.ts --route /evidence
 *   bun run scripts/measure-first-load.ts --grep framer-motion   # lazy-chunk ceiling check
 *   bun run scripts/measure-first-load.ts --all-chunks           # every built chunk, desc
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const NEXT_DIR = join(import.meta.dir, "..", ".next");

function gzipKiB(buf: Buffer): number {
  return gzipSync(buf, { level: 9 }).byteLength / 1024;
}

/** Route ("/" | "/evidence") → prerendered HTML path under .next/server/app. */
function htmlPathFor(route: string): string {
  const stem = route === "/" ? "index" : route.replace(/^\//, "");
  return join(NEXT_DIR, "server", "app", `${stem}.html`);
}

/** The static JS assets the route's first paint references (dedup'd, /_next/static/ only). */
function firstLoadScripts(html: string): readonly string[] {
  const refs = new Set<string>();
  // script src=... and preload/modulepreload href=... — both forms carry first-load JS.
  for (const m of html.matchAll(
    /(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g,
  )) {
    refs.add(String(m[1]));
  }
  return [...refs].sort();
}

function measureRoute(route: string): void {
  const htmlFile = htmlPathFor(route);
  const html = readFileSync(htmlFile, "utf8");
  const scripts = firstLoadScripts(html);
  let total = 0;
  const rows: { file: string; kib: number }[] = [];
  for (const ref of scripts) {
    const disk = join(NEXT_DIR, ref.replace(/^\/_next\//, ""));
    const kib = gzipKiB(readFileSync(disk));
    total += kib;
    rows.push({ file: ref, kib });
  }
  rows.sort((a, b) => b.kib - a.kib);
  console.log(`route ${route} — first-load JS (gzip -9), from ${htmlFile}`);
  for (const r of rows)
    console.log(`  ${r.kib.toFixed(1).padStart(7)} KiB  ${r.file}`);
  console.log(
    `  TOTAL ${total.toFixed(1)} KiB gzip across ${rows.length} scripts`,
  );
}

function allChunks(): { file: string; path: string; kib: number }[] {
  const dir = join(NEXT_DIR, "static", "chunks");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => {
      const path = join(dir, f);
      // statSync guards the readdir race (a dir entry is never a file we skip silently).
      if (!statSync(path).isFile()) return null;
      return { file: f, path, kib: gzipKiB(readFileSync(path)) };
    })
    .filter((r): r is { file: string; path: string; kib: number } => r !== null)
    .sort((a, b) => b.kib - a.kib);
}

const args = process.argv.slice(2);
function flagValue(name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? String(args[i + 1]) : null;
}

const grep = flagValue("--grep");
if (grep !== null) {
  let total = 0;
  let n = 0;
  for (const c of allChunks()) {
    if (readFileSync(c.path, "utf8").includes(grep)) {
      console.log(`  ${c.kib.toFixed(1).padStart(7)} KiB  chunks/${c.file}`);
      total += c.kib;
      n++;
    }
  }
  console.log(
    `  TOTAL ${total.toFixed(1)} KiB gzip across ${n} chunks containing "${grep}"`,
  );
} else if (args.includes("--all-chunks")) {
  for (const c of allChunks())
    console.log(`  ${c.kib.toFixed(1).padStart(7)} KiB  chunks/${c.file}`);
} else {
  measureRoute(flagValue("--route") ?? "/");
}
