import { describe, expect, test } from "bun:test";

import { rootGraph, SAME_AS, serializeJsonLd } from "./jsonld.ts";

// `sameAs` is an identity claim read by crawlers and answer engines. An entry that does not
// resolve for an ANONYMOUS visitor is a BROKEN claim, not a weak one — and that is exactly what
// shipped: the root graph advertised `https://github.com/caisson-sh/caisson`, the DEVELOPMENT
// repo, which is private and returns 404 when logged out. The public org page resolves 200.
// These assertions pin the corrected value so it cannot drift back to a 404.
describe("Organization sameAs", () => {
  const org = rootGraph["@graph"].find((n) => n["@type"] === "Organization") as
    | { sameAs?: readonly string[] }
    | undefined;

  test("the Organization node actually carries sameAs", () => {
    // Shape floor first: every assertion below is vacuous if this node or field is absent.
    expect(org).toBeDefined();
    expect(org?.sameAs).toBeDefined();
    expect(org?.sameAs?.length).toBeGreaterThan(0);
  });

  test("claims the public org page, never the private development repo", () => {
    expect(org?.sameAs).toContain("https://github.com/caisson-sh");
    expect(org?.sameAs).not.toContain("https://github.com/caisson-sh/caisson");
  });

  test("never claims a name that belongs to an unrelated project", () => {
    for (const forbidden of [
      "https://www.npmjs.com/package/caisson",
      "https://crates.io/crates/caisson",
    ]) {
      expect(org?.sameAs).not.toContain(forbidden);
    }
  });

  test("every entry is https and none points at the private repo path", () => {
    for (const url of SAME_AS) {
      expect(new URL(url).protocol).toBe("https:");
      expect(url).not.toContain("/caisson-sh/caisson");
    }
  });

  test("serializes without breaking out of the script element", () => {
    expect(serializeJsonLd({ a: "</script>" })).not.toContain("</script>");
  });
});
