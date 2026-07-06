import { describe, expect, test } from "bun:test";
import { parseSource } from "./chunk.ts";
import {
  generatePricingSources,
  PricingFactsSchema,
  type PricingFacts,
} from "./pricing-doc.ts";
import { DocChunkSchema } from "./types.ts";

// A hand-built facts fixture (the shape `loadPricingFacts` produces from the live SOT): two persona
// bundles plus the whole-catalog Everything, a shared member, and a standalone SKU no persona
// bundle grants — so the Everything-includes-all rule and the standalone line are both exercised.
const FACTS: PricingFacts = {
  bundles: [
    {
      id: "compliance",
      label: "Compliance",
      amount: 1049,
      unit: "once",
      from: false,
      note: "Own the source. Fail-closed RLS, WORM, audit chain.",
    },
    {
      id: "ai-production",
      label: "AI-Production",
      amount: 739,
      unit: "once",
      from: false,
      note: "The production-rigor layer cheap AI boilerplate skips.",
    },
    {
      id: "everything",
      label: "Everything",
      amount: 2059,
      unit: "once",
      from: false,
      note: "The full catalog, one purchase.",
    },
  ],
  modules: [
    {
      id: "field-crypto",
      label: "Field encryption",
      amount: 199,
      bundles: ["compliance", "ai-production"],
      blurb: "Per-tenant field encryption (HKDF-SHA256).",
    },
    {
      id: "ai-meter",
      label: "Token metering",
      amount: 149,
      bundles: ["ai-production"],
      blurb: "PG-atomic token metering with per-tenant spend caps.",
    },
    {
      id: "org-controls",
      label: "Org controls",
      amount: 249,
      bundles: [],
      blurb: "WorkOS SSO plus the owner-gated multi-user surface.",
    },
  ],
  plans: [
    {
      id: "developer",
      label: "Developer plan",
      amount: 499,
      unit: "year",
      from: false,
      note: "Credits, updates, and private-registry access.",
    },
    {
      id: "enterprise",
      label: "Enterprise",
      amount: null,
      unit: null,
      from: false,
      note: "Custom procurement, SSO, and support SLAs.",
    },
  ],
};

function raw(source: string, facts: PricingFacts = FACTS): string {
  const src = generatePricingSources(facts).find((s) => s.source === source);
  if (src === undefined) throw new Error(`no generated source ${source}`);
  return src.raw;
}

describe("generatePricingSources", () => {
  test("is deterministic — identical facts yield byte-identical sources", () => {
    expect(generatePricingSources(FACTS)).toEqual(
      generatePricingSources(FACTS),
    );
  });

  test("renders each bundle's committed price and composed modules", () => {
    const bundles = raw("pricing/bundles");
    expect(bundles).toContain("## Compliance — $1,049");
    expect(bundles).toContain("## AI-Production — $739");
    expect(bundles).toContain("Includes: Field encryption ($199)");
  });

  test("the Everything bundle includes every module (the explicit full-catalog rule)", () => {
    const bundles = raw("pricing/bundles");
    const everything = bundles.slice(bundles.indexOf("## Everything"));
    expect(everything).toContain("Org controls ($249)");
    expect(everything).toContain("Field encryption ($199)");
    expect(everything).toContain("Token metering ($149)");
  });

  test("renders each module's price and owning bundles, incl. the standalone line", () => {
    const modules = raw("pricing/modules");
    expect(modules).toContain("## Token metering — $149");
    expect(modules).toContain("Part of the AI-Production bundle(s)");
    expect(modules).toContain("## Org controls — $249");
    expect(modules).toContain(
      "only the whole-catalog Everything bundle includes it",
    );
  });

  test("renders the plans, incl. Enterprise 'Contact us'", () => {
    const plans = raw("pricing/plans");
    expect(plans).toContain("## Developer plan — $499/yr");
    expect(plans).toContain("## Enterprise — Contact us");
  });

  test("a changed price regenerates the doc (new figure in, old figure out)", () => {
    const bumped: PricingFacts = {
      ...FACTS,
      bundles: FACTS.bundles.map((b) =>
        b.id === "compliance" ? { ...b, amount: 1149 } : b,
      ),
    };
    const before = raw("pricing/bundles");
    const after = raw("pricing/bundles", bumped);
    expect(after).not.toBe(before);
    expect(after).toContain("## Compliance — $1,149");
    expect(after).not.toContain("## Compliance — $1,049");
  });

  test("every generated source chunks into valid DocChunks tagged kind:pricing", () => {
    for (const src of generatePricingSources(FACTS)) {
      const { chunks } = parseSource(src);
      expect(chunks.length).toBeGreaterThan(0);
      for (const c of chunks) {
        expect(() => DocChunkSchema.parse(c)).not.toThrow();
        expect(c.kind).toBe("pricing");
      }
    }
  });
});

describe("PricingFactsSchema", () => {
  test("accepts the live SOT shape and rejects an unknown top-level field (strict)", () => {
    expect(() => PricingFactsSchema.parse(FACTS)).not.toThrow();
    expect(() => PricingFactsSchema.parse({ ...FACTS, bogus: 1 })).toThrow();
  });
});
