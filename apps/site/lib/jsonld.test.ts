import { test, expect, describe } from "bun:test";

import { ORG_ID, PARENT_ORG_ID, rootGraph, serializeJsonLd } from "./jsonld";
import { PARENT_ORG_URL, SITE_URL } from "./metadata";

// The entity graph spans two sites: caisson.sh declares `parentOrganization` and the GridWork hub
// (gridworkdigital.com) declares the matching `subOrganization`. The edge only merges into one
// entity if BOTH halves use the identical IRI, and a typo produces no error anywhere — just two
// unrelated organizations in every consumer's index. These pin the exact strings the hub reads.

const org = rootGraph["@graph"].find((n) => n["@type"] === "Organization") as {
  "@id": string;
  sameAs?: readonly string[];
  parentOrganization?: { "@id": string };
};

describe("entity graph", () => {
  test("the Organization @id is the IRI the hub's subOrganization edge points at", () => {
    expect(ORG_ID).toBe("https://caisson.sh/#organization");
    expect(org["@id"]).toBe(ORG_ID);
  });

  test("parentOrganization is the hub's own Organization @id, verbatim", () => {
    expect(PARENT_ORG_ID).toBe("https://gridworkdigital.com/#organization");
    expect(org.parentOrganization).toEqual({ "@id": PARENT_ORG_ID });
  });

  test("sameAs claims only https URLs, and never a private or third-party surface", () => {
    expect(org.sameAs?.length).toBeGreaterThan(0);
    for (const url of org.sameAs ?? []) {
      expect(new URL(url).protocol).toBe("https:");
    }
    // caisson-sh/caisson is the PRIVATE development repo — it 404s for anonymous crawlers, so
    // claiming it is a dead identity edge. The bare `caisson` package names on npm and crates.io
    // belong to unrelated projects (a static-site deployer and a Docker updater respectively).
    for (const forbidden of [
      "https://github.com/caisson-sh/caisson",
      "https://www.npmjs.com/package/caisson",
      "https://crates.io/crates/caisson",
    ]) {
      expect(org.sameAs).not.toContain(forbidden);
    }
  });

  test("every absolute URL in the graph is on caisson.sh or the parent org", () => {
    for (const url of serializeJsonLd(rootGraph).match(/https:\/\/[^"\\]+/g) ??
      []) {
      if (url.startsWith("https://schema.org")) continue;
      if (url.startsWith("https://github.com")) continue;
      expect(
        url.startsWith(SITE_URL) || url.startsWith(PARENT_ORG_URL),
      ).toBeTrue();
    }
  });
});
