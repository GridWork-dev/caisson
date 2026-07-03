import { describe, expect, test } from "bun:test";
import { parseSource } from "./chunk.ts";
import {
  generatePricingSources,
  PricingFactsSchema,
  type PricingFacts,
} from "./pricing-doc.ts";
import { DocChunkSchema } from "./types.ts";

// A hand-built facts fixture (the shape `loadPricingFacts` produces from the live SOT). Editions sum
// to 1398, the bundle is 999 → a real 399 saving, so the computed savings line is exercised.
const FACTS: PricingFacts = {
  editions: [
    {
      id: "compliance",
      label: "Compliance",
      amount: 799,
      unit: "once",
      from: false,
      note: "Own the source. Fail-closed RLS, WORM, audit chain.",
    },
    {
      id: "ai-kit",
      label: "AI Production Kit",
      amount: 599,
      unit: "once",
      from: false,
      note: "The production-rigor layer cheap AI boilerplate skips.",
    },
  ],
  modules: [
    {
      id: "field-crypto",
      label: "Field encryption",
      amount: 199,
      edition: "compliance",
      blurb: "Per-tenant field encryption (HKDF-SHA256).",
    },
    {
      id: "ai-meter",
      label: "Token metering",
      amount: 149,
      edition: "ai-kit",
      blurb: "PG-atomic token metering with per-tenant spend caps.",
    },
  ],
  plans: [
    {
      id: "bundle",
      label: "Everything bundle",
      amount: 999,
      unit: "once",
      from: false,
      note: "All four editions plus the base, one purchase.",
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

  test("renders each edition's committed price and composed modules", () => {
    const editions = raw("pricing/editions");
    expect(editions).toContain("## Compliance — $799");
    expect(editions).toContain("## AI Production Kit — $599");
    expect(editions).toContain("Includes: Field encryption ($199)");
  });

  test("renders each module's price and owning edition", () => {
    const modules = raw("pricing/modules");
    expect(modules).toContain("## Token metering — $149");
    expect(modules).toContain("Part of the AI Production Kit edition.");
  });

  test("renders the bundle, its computed saving, and Enterprise 'Contact us'", () => {
    const plans = raw("pricing/plans");
    expect(plans).toContain("## Everything bundle — $999");
    expect(plans).toContain(
      "Saves $399 versus buying the four editions separately.",
    );
    expect(plans).toContain("## Enterprise — Contact us");
  });

  test("a changed price regenerates the doc (new figure in, old figure out)", () => {
    const bumped: PricingFacts = {
      ...FACTS,
      editions: FACTS.editions.map((e) =>
        e.id === "compliance" ? { ...e, amount: 899 } : e,
      ),
    };
    const before = raw("pricing/editions");
    const after = raw("pricing/editions", bumped);
    expect(after).not.toBe(before);
    expect(after).toContain("## Compliance — $899");
    expect(after).not.toContain("## Compliance — $799");
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
