import { describe, expect, test } from "bun:test";

import {
  HUB_CASE_STUDY_ID,
  HUB_FOUNDER_ID,
  rootGraph,
  SAME_AS,
  serializeJsonLd,
} from "./jsonld.ts";

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

// R19 entity edges (operator "A+C", 2026-08-25). The two orgs are separate LLCs, so the ONLY
// truthful cross-domain predicates are a shared founder Person and the hub case study's `about`
// mirrored as `subjectOf`. The IRIs are pinned as LITERALS here, not via the exported constants:
// editing the constant must red this file. The negative guard runs over the SERIALIZED root
// graph so a subsidiary predicate cannot sneak in on any node under any spelling.
describe("Organization entity edges to the GridWork hub", () => {
  const org = rootGraph["@graph"].find((n) => n["@type"] === "Organization") as
    | { founder?: { "@id": string }; subjectOf?: { "@id": string } }
    | undefined;

  test("shape floor: the Organization carries both edges", () => {
    expect(org?.founder).toBeDefined();
    expect(org?.subjectOf).toBeDefined();
  });

  test("founder is the hub's Person IRI, verbatim", () => {
    expect(org?.founder).toEqual({
      "@id": "https://gridworkdigital.com/#founder",
    });
    expect(HUB_FOUNDER_ID).toBe("https://gridworkdigital.com/#founder");
  });

  test("subjectOf is the hub's case-study IRI, verbatim", () => {
    expect(org?.subjectOf).toEqual({
      "@id": "https://gridworkdigital.com/work/caisson-reliability#casestudy",
    });
    expect(HUB_CASE_STUDY_ID).toBe(
      "https://gridworkdigital.com/work/caisson-reliability#casestudy",
    );
  });

  test("never publishes a subsidiary predicate on any node", () => {
    const serialized = serializeJsonLd(rootGraph);
    expect(serialized).not.toMatch(/parentOrganization/i);
    expect(serialized).not.toMatch(/subOrganization/i);
    expect(serialized).not.toMatch(/gridworkdigital\.com\/#organization/);
  });

  test("the Person is referenced by @id only — no inline org back-reference", () => {
    const serialized = serializeJsonLd(rootGraph);
    // A founder node inlined here would let a `worksFor`/`memberOf` claim ride in unreviewed.
    expect(serialized).not.toMatch(/worksFor|memberOf|affiliation/);
    expect(Object.keys(org?.founder ?? {})).toEqual(["@id"]);
  });
});
