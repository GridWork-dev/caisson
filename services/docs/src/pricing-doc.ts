// src/pricing-doc.ts — deterministic pricing/bundle/module docs generated FROM the pricebook/catalog
// source of truth (ADR-0234 F4). NOT scraped page text: the facts are the committed data structures in
// `apps/site/lib/pricing.ts` (the display SOT the cart + JSON-LD also read), so a cited price cannot
// silently drift stale. The output is plain markdown `DocsSource`s that flow through the SAME
// `parseSource` chunker as every other corpus source — pricing chunks are ordinary `DocChunk`s with a
// `kind:"pricing"` tag. Pure + deterministic: a fixed `PricingFacts` yields byte-identical sources, and
// a changed price yields changed source text (it is regenerated). No I/O here — `loadPricingFacts`
// (corpus.ts) is the one impure stage that reads the live SOT off disk and validates it into this shape.
import { z } from "zod";
import type { DocsSource } from "./types.ts";

/** Billing unit, mirroring `apps/site/lib/pricing.ts` `PriceAnchor.unit` (`null` = "Contact us"). */
const priceUnitSchema = z.enum(["once", "month", "year"]).nullable();

/** One priced anchor — a bundle or a plan. Mirror of the SOT's `PriceAnchor` (strict: an added SOT
 *  field must be reflected here, not silently dropped, so the doc stays a faithful projection). */
const priceAnchorSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** Integer USD (money is never a float, ADR-0007); `null` = no fixed price (Enterprise). */
    amount: z.number().int().nonnegative().nullable(),
    unit: priceUnitSchema,
    from: z.boolean(),
    note: z.string(),
  })
  .strict();

/** One à-la-carte module. Mirror of the SOT's `ModulePrice`. */
const moduleFactSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    amount: z.number().int().nonnegative(),
    /** The bundles this module is a member of (1:N — the SOT's index-pinned `bundles[]`); empty =
     *  a standalone SKU only the whole-catalog Everything bundle grants. */
    bundles: z.array(z.string().min(1)),
    blurb: z.string(),
  })
  .strict();

/**
 * The pricing facts a prospect-facing doc renders. This is the validated projection of the live SOT
 * (`apps/site/lib/pricing.ts` `BUNDLE_PRICES` / `MODULE_PRICES` / `PLAN_PRICES`). Bounded + strict so
 * a shape drift in the SOT fails loudly at load rather than emitting a malformed pricing doc.
 */
export const PricingFactsSchema = z
  .object({
    bundles: z.array(priceAnchorSchema),
    modules: z.array(moduleFactSchema),
    /** The subscription/per-module/enterprise anchors (the SOT's `PLAN_PRICES`). */
    plans: z.array(priceAnchorSchema),
  })
  .strict();
export type PricingFacts = z.infer<typeof PricingFactsSchema>;

/** SPDX marker for the generated pricing docs — pricing is public information (as public as the open
 *  base docs), so it carries the open license, not the commercial module marker. */
const PRICING_LICENSE = "Apache-2.0";

type PriceLike = {
  amount: number | null;
  unit: z.infer<typeof priceUnitSchema>;
  from: boolean;
};

/** Render a price string identically to the SOT's `formatPrice` (deterministic — fixed `en-US`
 *  grouping) so a cited figure matches the site exactly: "from $49", "$1,499/yr", "Contact us". */
function fmtPrice(p: PriceLike): string {
  if (p.amount === null) return "Contact us";
  const money = `$${p.amount.toLocaleString("en-US")}`;
  const suffix = p.unit === "month" ? "/mo" : p.unit === "year" ? "/yr" : "";
  return `${p.from ? "from " : ""}${money}${suffix}`;
}

/** Bare integer-USD for a module — always a one-time perpetual license (no unit suffix). */
function moduleUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** Build a `DocsSource` for one generated pricing markdown doc (kind `pricing`, open license). */
function pricingSource(source: string, title: string, raw: string): DocsSource {
  return {
    source,
    kind: "pricing",
    license: PRICING_LICENSE,
    fallbackTitle: title,
    raw,
  };
}

function bundlesDoc(facts: PricingFacts): string {
  const lines = [
    "---",
    "title: Caisson bundles and pricing",
    "description: The six Caisson bundles, their one-time prices, and the modules each includes.",
    "---",
    "",
    "# Caisson bundles and pricing",
    "",
    "Caisson is a composable base substrate plus six bundles. Every bundle is a one-time perpetual",
    "purchase — you own the source. The prices below are the committed public prices.",
    "",
  ];
  for (const bundle of facts.bundles) {
    // The whole-catalog Everything bundle includes every sellable module by construction.
    const modules =
      bundle.id === "everything"
        ? facts.modules
        : facts.modules.filter((m) => m.bundles.includes(bundle.id));
    lines.push(`## ${bundle.label} — ${fmtPrice(bundle)}`, "", bundle.note, "");
    if (modules.length > 0) {
      const list = modules
        .map((m) => `${m.label} (${moduleUsd(m.amount)})`)
        .join(", ");
      lines.push(`Includes: ${list}.`, "");
    }
  }
  return lines.join("\n");
}

function modulesDoc(facts: PricingFacts): string {
  const bundleLabel = new Map(facts.bundles.map((b) => [b.id, b.label]));
  const lines = [
    "---",
    "title: Caisson modules a la carte",
    "description: Every Caisson module sold individually, its one-time price, and the bundles it belongs to.",
    "---",
    "",
    "# Caisson modules a la carte",
    "",
    "Any module can be bought on its own; buying a bundle is cheaper once you need several. Every",
    "module is a one-time perpetual license.",
    "",
  ];
  for (const mod of facts.modules) {
    lines.push(`## ${mod.label} — ${moduleUsd(mod.amount)}`, "", mod.blurb, "");
    if (mod.bundles.length === 0) {
      lines.push(
        "Standalone module — sold on its own; among the bundles, only the whole-catalog Everything bundle includes it.",
        "",
      );
    } else {
      const owners = mod.bundles.map((b) => bundleLabel.get(b) ?? b).join(", ");
      lines.push(`Part of the ${owners} bundle(s), and of Everything.`, "");
    }
  }
  return lines.join("\n");
}

/** Row ids the SOT prices as `amount: null` for reasons OTHER than "not yet purchasable" — Enterprise
 *  is a real, live "Contact us" CTA, not an unpriced/unshippable SKU, so it must survive the
 *  unpriced-row filter below even though it shares the same null-amount shape. */
const NULL_AMOUNT_IS_INTENTIONAL: ReadonlySet<string> = new Set(["enterprise"]);

function plansDoc(facts: PricingFacts): string {
  const lines = [
    "---",
    "title: Caisson plans",
    "description: Subscription plans, per-module purchase, and enterprise options.",
    "---",
    "",
    "# Caisson plans",
    "",
    "Beyond the one-time bundles: subscriptions, per-module purchase, and enterprise.",
    "",
  ];
  // A row with amount:null is UNPRICED (never purchasable yet, ADR-0278 Track K), not "Contact us
  // is the price" — emitting it here would put internal-register config copy ("Response-time
  // commitment: unset.") in front of a prospect on the public RAG corpus. Filtered by the null-amount
  // predicate, EXCEPT the explicitly-allowlisted ids above that are intentionally price-free.
  const plans = facts.plans.filter(
    (p) => p.amount !== null || NULL_AMOUNT_IS_INTENTIONAL.has(p.id),
  );
  for (const plan of plans) {
    lines.push(`## ${plan.label} — ${fmtPrice(plan)}`, "", plan.note, "");
  }
  return lines.join("\n");
}

/**
 * Generate the pricing corpus sources from validated facts. Deterministic + pure: same `facts` →
 * identical sources; a changed price → changed source text (regeneration is content-driven, ADR-0234
 * F4). Three docs so citations land on a coherent topic: bundles, modules, and the plans.
 */
export function generatePricingSources(facts: PricingFacts): DocsSource[] {
  return [
    pricingSource(
      "pricing/bundles",
      "Caisson bundles and pricing",
      bundlesDoc(facts),
    ),
    pricingSource(
      "pricing/modules",
      "Caisson modules a la carte",
      modulesDoc(facts),
    ),
    pricingSource("pricing/plans", "Caisson plans", plansDoc(facts)),
  ];
}
