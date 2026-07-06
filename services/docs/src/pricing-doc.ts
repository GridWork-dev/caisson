// src/pricing-doc.ts — deterministic pricing/edition/module docs generated FROM the pricebook/catalog
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

/** One priced anchor — an edition or a plan. Mirror of the SOT's `PriceAnchor` (strict: an added SOT
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
    /** The bundles this module is a member of (1:N — the SOT's index-pinned `bundles[]`). Mirrored
     *  here so the strict projection stays faithful; the doc rendering still keys off `edition` until
     *  the display flip migrates it (catalog-rework W6.2/W7.2). */
    bundles: z.array(z.string().min(1)),
    /** Owning edition id (matches an entry in `editions`) — transitional browse-family grouping. */
    edition: z.string().min(1),
    blurb: z.string(),
    /** Browse-family only: the module is NOT granted by its edition — sold standalone. Mirrors the
     *  SOT flag; the doc must never claim edition inclusion for these. */
    standaloneOnly: z.boolean().optional(),
  })
  .strict();

/**
 * The pricing facts a prospect-facing doc renders. This is the validated projection of the live SOT
 * (`apps/site/lib/pricing.ts` `EDITION_PRICES` / `MODULE_PRICES` / `PLAN_PRICES`). Bounded + strict so
 * a shape drift in the SOT fails loudly at load rather than emitting a malformed pricing doc.
 */
export const PricingFactsSchema = z
  .object({
    editions: z.array(priceAnchorSchema),
    modules: z.array(moduleFactSchema),
    /** The bundle + subscription/per-module/enterprise anchors (the SOT's `PLAN_PRICES`). */
    plans: z.array(priceAnchorSchema),
  })
  .strict();
export type PricingFacts = z.infer<typeof PricingFactsSchema>;

/** SPDX marker for the generated pricing docs — pricing is public information (as public as the open
 *  base docs), so it carries the open license, not the commercial edition marker. */
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

function editionsDoc(facts: PricingFacts): string {
  const lines = [
    "---",
    "title: Caisson editions and pricing",
    "description: The four Caisson editions, their one-time prices, and the modules each includes.",
    "---",
    "",
    "# Caisson editions and pricing",
    "",
    "Caisson is a composable base substrate plus four premium editions. Every edition is a one-time",
    "perpetual purchase — you own the source. The prices below are the committed public prices.",
    "",
  ];
  for (const edition of facts.editions) {
    // standaloneOnly rows are browse-family only — the edition does NOT grant them, so listing
    // them under "Includes:" would claim a grant that does not exist.
    const modules = facts.modules.filter(
      (m) => m.edition === edition.id && m.standaloneOnly !== true,
    );
    lines.push(
      `## ${edition.label} — ${fmtPrice(edition)}`,
      "",
      edition.note,
      "",
    );
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
  const editionLabel = new Map(facts.editions.map((e) => [e.id, e.label]));
  const lines = [
    "---",
    "title: Caisson modules a la carte",
    "description: Every Caisson module sold individually, its one-time price, and the edition it belongs to.",
    "---",
    "",
    "# Caisson modules a la carte",
    "",
    "Any module can be bought on its own; buying the whole edition or the Everything bundle is cheaper",
    "once you need several. Every module is a one-time perpetual license.",
    "",
  ];
  for (const mod of facts.modules) {
    lines.push(`## ${mod.label} — ${moduleUsd(mod.amount)}`, "", mod.blurb, "");
    if (mod.standaloneOnly === true) {
      lines.push(
        "Standalone module — sold on its own; not included in any edition or the Everything bundle.",
        "",
      );
    } else {
      const owner = editionLabel.get(mod.edition);
      if (owner !== undefined) lines.push(`Part of the ${owner} edition.`, "");
    }
  }
  return lines.join("\n");
}

function plansDoc(facts: PricingFacts): string {
  const lines = [
    "---",
    "title: Caisson bundle and plans",
    "description: The Everything bundle, subscription plans, and per-module and enterprise options.",
    "---",
    "",
    "# Caisson bundle and plans",
    "",
    "Beyond single editions: the Everything bundle, subscriptions, per-module purchase, and enterprise.",
    "",
  ];
  const editionsSubtotal = facts.editions.reduce(
    (sum, e) => sum + (e.amount ?? 0),
    0,
  );
  for (const plan of facts.plans) {
    lines.push(`## ${plan.label} — ${fmtPrice(plan)}`, "", plan.note, "");
    if (plan.id === "bundle" && plan.amount !== null) {
      const saves = Math.max(0, editionsSubtotal - plan.amount);
      if (saves > 0) {
        lines.push(
          `Saves $${saves.toLocaleString("en-US")} versus buying the four editions separately.`,
          "",
        );
      }
    }
  }
  return lines.join("\n");
}

/**
 * Generate the pricing corpus sources from validated facts. Deterministic + pure: same `facts` →
 * identical sources; a changed price → changed source text (regeneration is content-driven, ADR-0234
 * F4). Three docs so citations land on a coherent topic: editions, modules, and the bundle/plans.
 */
export function generatePricingSources(facts: PricingFacts): DocsSource[] {
  return [
    pricingSource(
      "pricing/editions",
      "Caisson editions and pricing",
      editionsDoc(facts),
    ),
    pricingSource(
      "pricing/modules",
      "Caisson modules a la carte",
      modulesDoc(facts),
    ),
    pricingSource("pricing/plans", "Caisson bundle and plans", plansDoc(facts)),
  ];
}
