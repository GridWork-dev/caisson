import { test, expect, describe } from "bun:test";

import robots from "./robots";
import sitemap from "./sitemap";
import { SITE_URL } from "@/lib/metadata";

// Crawl hygiene has no local failure mode — a wrong host or a crawlable non-page costs nothing at
// build time and shows up weeks later in the index. These assert the two invariants: every URL a
// crawler is handed is absolute on the canonical origin, and the framed demo embeds and the
// prebuilt search index are not offered at all.

describe("robots.txt", () => {
  test("points at the canonical absolute sitemap and host", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(r.host).toBe(SITE_URL);
  });

  test("every rule group disallows the demo embeds and the search index", () => {
    // robots.txt is most-specific-match: a bot with its own group ignores `*` entirely, so each
    // named AI-crawler group has to repeat the disallows rather than inherit them.
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBeTrue();
    for (const rule of rules as { disallow?: string | string[] }[]) {
      const disallow = [rule.disallow ?? []].flat();
      for (const path of ["/demos/", "/api/"]) {
        expect(disallow).toContain(path);
      }
    }
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  test("every URL is absolute on https://caisson.sh", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(
        entry.url.startsWith(`${SITE_URL}/`) || entry.url === SITE_URL,
      ).toBeTrue();
    }
  });

  test("no URL appears twice", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  test("never lists a path robots.txt disallows", () => {
    const disallowed = [robots().rules]
      .flat()
      .flatMap((r) => [r.disallow ?? []].flat());
    for (const entry of entries) {
      const path = entry.url.slice(SITE_URL.length);
      for (const blocked of disallowed) {
        expect(path === blocked || path.startsWith(`${blocked}/`)).toBeFalse();
      }
    }
  });

  test("lists /demo, which is public but has no internal links to be found by", () => {
    expect(entries.map((e) => e.url)).toContain(`${SITE_URL}/demo`);
  });
});
