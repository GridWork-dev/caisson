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

/**
 * The 12-month updates-renewal price in whole USD, or `null` for a row with no renewal figure
 * (unpriced SKUs, and list prices below the $23-ish floor where no X9 point exists — ADR-0130 keeps
 * those number-free rather than fabricating one). NOT a field on the SOT's own row objects: it is
 * `renewalAmount(id)`, the ADR-0260 §5 40%-floored-to-X9 function, evaluated per row at load time in
 * `loadPricingFacts`. Projected in because a buyer asking "what does renewing Compliance cost" must
 * land on the chunk that also carries "Compliance" and "$1,649" — the licensing page's renewal table
 * has the number but not the bundle adjacency, which is why that question used to retrieve the
 * $1,499 Updates plan instead (found on the live service 2026-07-28).
 */
const renewalSchema = z.number().int().positive().nullable();

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
    // Bundles carry a renewal figure; plans do not — a plan IS the recurring charge.
    bundles: z.array(priceAnchorSchema.extend({ renewal: renewalSchema })),
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

/**
 * The cost line for one bundle: the buyer's own words next to the number.
 *
 * Retrieval, not decoration. The FTS floor has no synonyms, so a heading that reads
 * `## Compliance — $1,649` matches neither "how much is the Compliance bundle" nor "what does
 * Compliance cost" — reproduced 2026-07-29 against the real corpus, where NO plain price question
 * put a single `pricing/*` chunk in the top 5 even though the whole point of the generated pricing
 * corpus (ADR-0234 F4) is answering exactly those. Cost/price/how-much/renew are the words buyers
 * actually type, so they belong in the chunk that holds the figure.
 */
function costLine(
  label: string,
  price: string,
  renewal: number | null,
): string {
  // Deliberately ONE terse sentence. A first draft spelled the renewal policy out per item and
  // pushed `licensing.mdx` out of the top-k for "how do I renew my license" — 33 copies of the same
  // explanation outrank the one page that actually owns the policy. The generated chunk carries the
  // NUMBER for this item; the policy prose stays where it belongs, in one place.
  const renewalPart =
    renewal === null
      ? ""
      : `, then $${renewal.toLocaleString("en-US")} per year to keep updates`;
  return `**How much does ${label} cost?** ${price} once${renewalPart}.`;
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
    // A null-amount bundle would render "Contact us once." — the schema permits that shape (it is
    // shared with the plans, where Enterprise is legitimately price-free), so skip the line rather
    // than emit a sentence no buyer should read.
    const cost =
      bundle.amount === null
        ? []
        : [
            costLine(
              `the ${bundle.label} bundle`,
              fmtPrice(bundle),
              bundle.renewal,
            ),
            "",
          ];
    lines.push(
      `## ${bundle.label} — ${fmtPrice(bundle)}`,
      "",
      ...cost,
      bundle.note,
      "",
    );
    // CAISSON-43: name every member module (id + label + price + one-line description), not just
    // a bare price list — a support query asking "what's in bundle X" needs the module id an agent
    // can pass to `--module`/`generate`, and the blurb, to be answerable from this chunk alone.
    if (modules.length > 0) {
      lines.push("Modules included:", "");
      for (const m of modules) {
        lines.push(
          `- **${m.label}** (\`${m.id}\`, ${moduleUsd(m.amount)}): ${m.blurb}`,
        );
      }
      lines.push("");
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
    // ponytail: no cost line on modules. Adding one to all 27 put "Audit chain + WORM — $149" above
    // the audit-worm doc for "WORM audit storage on S3" (the label repeats the query term) and
    // pushed licensing.mdx out of the top-5 for "how do I renew my license" (27 more "per year"
    // chunks). The reported live defect was about BUNDLES; extend to modules only if one is reported.
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
