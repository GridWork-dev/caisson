import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "bun:test";

// The Worker applies public/_redirects before it serves any asset, so a rule whose source is a real
// docs page makes that page unreachable: the page builds and exports, then 301s away in production.
// Every /docs source must have no page behind it.
const SITE = join(import.meta.dir, "..");
const DOCS = join(SITE, "content", "docs");

function redirectSources(): string[] {
  return readFileSync(join(SITE, "public", "_redirects"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split(/\s+/)[0] ?? "");
}

test("no /docs redirect source shadows a docs page", () => {
  const sources = redirectSources().filter((s) => s.startsWith("/docs/"));
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources) {
    const rel = source.slice("/docs/".length);
    const shadowed = rel.endsWith("/*")
      ? [join(DOCS, rel.slice(0, -2))]
      : [join(DOCS, `${rel}.mdx`), join(DOCS, rel, "index.mdx")];
    for (const path of shadowed) {
      expect({ source, pageExists: existsSync(path) }).toEqual({
        source,
        pageExists: false,
      });
    }
  }
});
