// Cloudflare Pages + Next static export: App Router can emit RSC-prefetch `*.txt` files beside
// the `*.html` pages. Cloudflare content-negotiates `Accept: text/plain` (Link prefetch) and may
// serve the `.txt`, yielding an intermittent blank page (the "index.txt trap", DEV 2026-06-21).
//
// Mitigation: remove any `*.txt` that has a same-named `*.html` sibling — those are the prefetch
// artifacts. Intentional text outputs (`llms.txt`, `llms-full.txt`, the per-page `content.md`) have
// no sibling `.html`, so they are preserved. No-op if Next emitted none.
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const OUT = new URL("../out/", import.meta.url).pathname;

async function walk(dir) {
  let removed = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0; // out/ missing — nothing to do
  }
  const names = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += await walk(full);
    } else if (entry.name.endsWith(".txt")) {
      const html = entry.name.slice(0, -4) + ".html";
      if (names.has(html)) {
        await unlink(full);
        removed += 1;
      }
    }
  }
  return removed;
}

const exists = await stat(OUT).then(
  () => true,
  () => false,
);
if (!exists) {
  process.stdout.write("normalize-export: out/ not found — skipped\n");
} else {
  const removed = await walk(OUT);
  process.stdout.write(
    `normalize-export: removed ${removed} RSC .txt sibling(s)\n`,
  );
}
