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
      amount: 1649,
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
      amount: 2259,
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
    // Priority-support (ADR-0278 Track K): unpriced today, mirroring the live SOT (`pricing.ts`
    // `PLAN_PRICES`) exactly — a real fixture case, not a hypothetical, since this row already ships
    // in the SOT ahead of its price.
    {
      id: "priority-support",
      label: "Priority support",
      amount: null,
      unit: null,
      from: false,
      note: "Response-time commitment: unset.",
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
    expect(bundles).toContain("## Compliance — $1,649");
    expect(bundles).toContain("## AI-Production — $739");
    expect(bundles).toContain(
      "- **Field encryption** (`field-crypto`, $199): Per-tenant field encryption (HKDF-SHA256).",
    );
  });

  // CAISSON-43: the RAG corpus must be able to answer "what's in bundle X" from this chunk alone —
  // the module id (for `--module`/`generate`) and a one-line description, not just a price list.
  test("names each module's id and one-line description alongside its price", () => {
    const bundles = raw("pricing/bundles");
    expect(bundles).toContain("`field-crypto`");
    expect(bundles).toContain("`ai-meter`");
    expect(bundles).toContain(
      "PG-atomic token metering with per-tenant spend caps.",
    );
  });

  test("the Everything bundle includes every module (the explicit full-catalog rule)", () => {
    const bundles = raw("pricing/bundles");
    const everything = bundles.slice(bundles.indexOf("## Everything"));
    expect(everything).toContain("**Org controls** (`org-controls`, $249)");
    expect(everything).toContain("**Field encryption** (`field-crypto`, $199)");
    expect(everything).toContain("**Token metering** (`ai-meter`, $149)");
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

  // ADR-0278 Track K (fable F2, pre-merge fix): an unpriced row must never reach the public RAG
  // corpus — a prospect would be handed internal-register config copy ("Response-time commitment:
  // unset.") as if it were a real answer. Enterprise shares the null-amount shape but is a real,
  // live "Contact us" CTA, so it must still render — proving the filter is id-scoped, not a blanket
  // "any null amount disappears" rule that would silently break Enterprise too.
  test("an unpriced plan (priority-support) is absent from the corpus; Enterprise still renders", () => {
    const plans = raw("pricing/plans");
    expect(plans).not.toContain("Priority support");
    expect(plans).not.toContain("Response-time commitment: unset.");
    expect(plans).toContain("## Enterprise — Contact us");
  });

  test("the unpriced plan reappears once the SOT sets a real amount", () => {
    const priced: PricingFacts = {
      ...FACTS,
      plans: FACTS.plans.map((p) =>
        p.id === "priority-support"
          ? {
              ...p,
              amount: 199,
              unit: "month" as const,
              note: "Priority response lane.",
            }
          : p,
      ),
    };
    const plans = raw("pricing/plans", priced);
    expect(plans).toContain("## Priority support — $199/mo");
  });

  test("a changed price regenerates the doc (new figure in, old figure out)", () => {
    const bumped: PricingFacts = {
      ...FACTS,
      bundles: FACTS.bundles.map((b) =>
        b.id === "compliance" ? { ...b, amount: 1849 } : b,
      ),
    };
    const before = raw("pricing/bundles");
    const after = raw("pricing/bundles", bumped);
    expect(after).not.toBe(before);
    expect(after).toContain("## Compliance — $1,849");
    expect(after).not.toContain("## Compliance — $1,649");
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
