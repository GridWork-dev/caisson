// Committed pricing — the Q4 below-sum lock (supersedes the ADR-0129 edition numbers this file
// briefly shipped, which themselves superseded the ADR-0106/ADR-0082 sheet). Shown as the prices —
// NO "subject to change" hedge. The operator may still adjust a final number before checkout goes
// live, but the site no longer says so. Amounts are integer USD (money is never a float,
// ADR-0007). All four editions are commercial (ADR-0083 made Local-first commercial — no free/AGPL
// tier). Single source — pages, SKU grid, cart, and JSON-LD Offers all read from here so a number
// never drifts between surfaces.
//
// Honesty floor (ADR-0130): the site was NEVER live at any earlier number, so a struck-through
// "was $X now $Y" per-edition or per-module anchor would imply a price no customer ever paid — a
// fabricated discount the guardrails module itself forbids (FTC 4Ps). There is therefore NO
// per-anchor compare/"was" price on this sheet. The ONE truthful comparison kept is the Everything
// bundle's "Save $N vs buying the four editions separately" badge (`bundleSavings()`), a real
// saving against the live à-la-carte subtotal — not an invented price history. Every edition is a
// real buyable product (no "roadmap" gating), and the per-module offering is a REAL catalog
// (`MODULE_PRICES`), not a single "from $49" placeholder line.

export interface PriceAnchor {
  /** Stable id (also the JSON-LD Offer key). */
  id: string;
  /** Display name. */
  label: string;
  /** Integer USD. `null` = no fixed price ("Contact us" — Enterprise). */
  amount: number | null;
  /** Billing unit. `once` = one-time perpetual; `month` / `year` = subscription cadence. */
  unit: "once" | "month" | "year" | null;
  /** Render as "from $X" (entry price of a range). */
  from: boolean;
  /** One-line position note. */
  note: string;
}

/** The four editions, in display order. Every edition is commercial (ADR-0083) and buyable — none
 *  is gated behind a "roadmap" framing (the storefront rework shows the full catalog). */
export const EDITION_IDS = [
  "compliance",
  "ai-kit",
  "local-first",
  "agentic-dev",
] as const;
export type EditionId = (typeof EDITION_IDS)[number];

export function isEditionId(id: string): id is EditionId {
  return (EDITION_IDS as readonly string[]).includes(id);
}

/** The four editions. Compliance is the hero anchor; all four are commercial (ADR-0083). */
export const EDITION_PRICES: readonly PriceAnchor[] = [
  {
    id: "compliance",
    label: "Compliance",
    amount: 799,
    unit: "once",
    from: false,
    note: "Own the source. Fail-closed RLS, WORM, audit chain, evidence packs.",
  },
  {
    id: "ai-kit",
    label: "AI Production Kit",
    amount: 599,
    unit: "once",
    from: false,
    note: "The production-rigor layer cheap AI boilerplate skips.",
  },
  {
    id: "agentic-dev",
    label: "Agentic-Dev",
    amount: 249,
    unit: "once",
    from: false,
    note: "The governed-agent kernel — typed agent/skill/rule schema, a guarded lifecycle, and a hooks dispatcher.",
  },
  {
    id: "local-first",
    label: "Local-first AI",
    amount: 349,
    unit: "once",
    from: false,
    note: "Own the source. On-device inference, a privacy gate, and vector search — your data never leaves the device.",
  },
] as const;

/** Every module sold à la carte, grouped by the edition it composes into (customer-facing
 *  grouping — mirrors the SKU matrix on `/pricing`, not the registry's internal base/edition
 *  split). Prices are the locked $49-$299 band. */
export interface ModulePrice {
  /** Slug — the cart key and the Plausible event prop. */
  id: string;
  label: string;
  /** Integer USD, one-time. */
  amount: number;
  edition: EditionId;
  /** Customer-facing benefit, one line — not the internal package README description. */
  blurb: string;
  /**
   * True when NO edition (and therefore not the bundle either — bundle = base ∪ edition members)
   * grants this module: `edition` is then a browse-family only, and the /build + cart upgrade
   * nudge must never claim an edition covers it. Truth source: the registry index members maps
   * (pinned by pricing.test.ts against registry/index.json).
   */
  standaloneOnly?: true;
}

export const MODULE_PRICES: readonly ModulePrice[] = [
  // À-la-carte = the standalone modules only (ADR-0238): the four edition-core rows
  // ("Compliance core", "Agent-setup config bundles", "On-device inference", "Dev-loop tooling")
  // were dropped — an edition's core composes its commercial members at runtime, so it has no
  // separable artifact to sell; editions are how you buy composition.
  // ---- Compliance ----
  {
    id: "field-crypto",
    label: "Field encryption",
    amount: 199,
    edition: "compliance",
    blurb:
      "Per-tenant field encryption (HKDF-SHA256). Sealed at rest, refused across tenants — proven, not promised.",
  },
  {
    id: "audit-worm",
    label: "Audit chain + WORM",
    amount: 149,
    edition: "compliance",
    blurb:
      "Append-only SHA-256 audit chain plus S3 Object-Lock WORM evidence storage. Tamper breaks the link.",
  },
  {
    id: "retention-runner",
    label: "Retention runner",
    amount: 199,
    edition: "compliance",
    blurb:
      "Policy-driven data retention on a schedule — expiry and legal-hold, enforced automatically.",
  },
  {
    // Grouped under compliance because that is the edition that composes @caisson/alerting
    // (packages/compliance dependency; ADR-0205) — an ai-kit grouping would let the /build
    // edition nudge sell an upgrade that loses this module.
    id: "alerting",
    label: "Alert pipeline",
    amount: 149,
    edition: "compliance",
    blurb:
      "Deduped, rate-capped alert delivery with quiet hours and an audit trail — the SOC 2 CC7.2 alerting control, not another webhook blaster.",
  },
  // ---- AI Production Kit ----
  {
    id: "ai-meter",
    label: "Token metering",
    amount: 199,
    edition: "ai-kit",
    blurb:
      "PG-atomic token metering with per-tenant spend caps and a circuit breaker — a runaway prompt loop can't run your bill up.",
  },
  {
    // Browse-family only: @caisson/ai-evals is standalone BY DESIGN (its manifest: "not a base
    // service or an edition") — the ai-kit edition's registry members map does not include it, so
    // an edition/bundle purchase never grants it. `standaloneOnly` keeps the upgrade nudge and
    // every "included in" surface honest.
    id: "ai-evals",
    label: "Eval harness",
    amount: 199,
    edition: "ai-kit",
    standaloneOnly: true,
    blurb:
      "Regression-grade evals that run in CI, not in prod. A model swap fails the build first, not a customer's session.",
  },
  {
    id: "guardrails",
    label: "Guardrails",
    amount: 149,
    edition: "ai-kit",
    blurb:
      "Input and output guardrails between your app and the model — one seam to harden, not one per call site.",
  },
  {
    id: "prompt-registry",
    label: "Prompt registry",
    amount: 99,
    edition: "ai-kit",
    blurb:
      "Versioned prompts with rollout history. No more prompts hardcoded three layers deep in a route handler.",
  },
  // ---- Local-first AI ----
  {
    id: "local-store",
    label: "Local vector store",
    amount: 99,
    edition: "local-first",
    blurb:
      "Hybrid FTS5 + sqlite-vec search on disk. Semantic recall with nothing shipped to a vector cloud.",
  },
  // ---- Agentic-Dev ----
  {
    id: "agent-kernel",
    label: "Agent kernel",
    amount: 199,
    edition: "agentic-dev",
    blurb:
      "Typed agent/skill/rule schema plus the guarded lifecycle state machine — VERIFY failing reopens PLAN, there's no edge to SHIP.",
  },
  {
    id: "agent-runner",
    label: "Agent runner",
    amount: 49,
    edition: "agentic-dev",
    blurb:
      "Sandboxed, governed agent execution — spawn a headless coding agent in an isolated worktree, stream an auditable transcript, zero secret leak by construction.",
  },
] as const;

/** Every module belonging to `edition`, in catalog order. */
export function modulesByEdition(edition: EditionId): readonly ModulePrice[] {
  return MODULE_PRICES.filter((m) => m.edition === edition);
}

/** The cheapest module in the whole catalog — the real floor of the "from $X" per-module anchor
 *  below (computed, never hand-duplicated, so the two numbers can't drift). */
const MODULE_MIN_AMOUNT = Math.min(...MODULE_PRICES.map((m) => m.amount));

/** Purchase structures beyond single editions. */
export const PLAN_PRICES: readonly PriceAnchor[] = [
  {
    id: "bundle",
    label: "Everything bundle",
    amount: 1499,
    unit: "once",
    from: false,
    note: "All four editions plus the base, one purchase.",
  },
  {
    id: "module",
    label: "Per-module",
    amount: MODULE_MIN_AMOUNT,
    unit: "once",
    from: true,
    note: "Take a single module à la carte — 11 standalone modules across the four editions.",
  },
  {
    id: "compliance-updates",
    label: "Compliance Updates",
    amount: 1499,
    unit: "year",
    from: false,
    note: "Framework updates, evidence-pack refreshes, private-registry pulls.",
  },
  {
    id: "developer",
    label: "Developer plan",
    amount: 499,
    unit: "year",
    from: false,
    note: "Credits, updates, and private-registry access for active builders.",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    amount: null,
    unit: null,
    from: false,
    note: "Custom procurement, SSO, and support SLAs for regulated teams at scale.",
  },
] as const;

/** Render an anchor as a display string, e.g. "from $2,499", "$1,499/yr", "Contact us". */
export function formatPrice(
  p: Pick<PriceAnchor, "amount" | "unit" | "from">,
): string {
  if (p.amount === null) return "Contact us";
  const money = `$${p.amount.toLocaleString("en-US")}`;
  const suffix = p.unit === "month" ? "/mo" : p.unit === "year" ? "/yr" : "";
  return `${p.from ? "from " : ""}${money}${suffix}`;
}

/** Render a bare integer USD amount, e.g. 299 -> "$299" — for module/cart/savings figures that
 *  fall outside the `PriceAnchor` shape `formatPrice` expects. */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** Lookup by id across both tables. */
export function priceById(id: string): PriceAnchor | undefined {
  return [...EDITION_PRICES, ...PLAN_PRICES].find((p) => p.id === id);
}

/** Sum of the four edition prices — the "buy each edition separately" baseline the bundle is
 *  compared against for its savings badge. */
export function editionsSubtotal(): number {
  return EDITION_PRICES.reduce((sum, p) => sum + (p.amount ?? 0), 0);
}

/** What the Everything bundle saves vs buying all four editions separately, in whole USD. Clamped
 *  at 0 (never a negative "saving") in case a future reprice inverts the math. */
export function bundleSavings(): number {
  const bundle = priceById("bundle");
  if (!bundle || bundle.amount === null) return 0;
  return Math.max(0, editionsSubtotal() - bundle.amount);
}

/** Formatted starting price for an edition slug, or an em-dash if the slug has no anchor. */
export function editionPrice(id: string): string {
  const p = priceById(id);
  return p ? formatPrice(p) : "—";
}

// ---- The editions × capabilities comparison matrix — SINGLE SOURCE (ADR-0195) ----
// Was hand-duplicated across /pricing and the home teaser and had drifted (the two copies
// disagreed on ≥3 rows); this is now the one authoritative copy. /pricing renders the feature
// rows PLUS the starting-price row; the home teaser renders the feature rows only.

/** A comparison-matrix row — structurally the kit's `SkuMatrixRow`, kept UI-decoupled here. */
export interface SkuRow {
  label: string;
  /** One cell per column: `true` = included, `false` = not, or a display string. */
  cells: readonly (boolean | string)[];
}

/** Matrix columns, in edition display order. */
export const SKU_COLUMNS = [
  "Compliance",
  "AI Kit",
  "Local-first",
  "Agentic-Dev",
] as const;

/** The capability rows (no price row) — the home teaser shows exactly these. A cell is an
 *  INCLUSION claim, so every ✓/✗ is pinned to the registry index members maps (the entitlement
 *  truth an edition purchase actually expands to) — see the membership lint in pricing.test.ts.
 *  Base capabilities (Apache-2.0, ship with everything — incl. fail-closed RLS) live on the one
 *  base row; the eval harness is standalone-only (no edition row can claim it). */
export const SKU_FEATURE_ROWS: readonly SkuRow[] = [
  {
    label: "Postgres base — fail-closed RLS, auth, billing (Apache-2.0)",
    cells: [true, true, true, true],
  },
  {
    label: "RLS-force evidence collector + isolation tests",
    cells: [true, false, false, false],
  },
  { label: "WORM evidence store", cells: [true, false, false, false] },
  { label: "Append-only audit chain", cells: [true, false, false, false] },
  { label: "Per-tenant field encryption", cells: [true, true, true, false] },
  { label: "Evidence-pack generator", cells: [true, false, false, false] },
  {
    label: "Alert pipeline + retention runner",
    cells: [true, false, false, false],
  },
  { label: "Token metering · spend caps", cells: [false, true, false, false] },
  {
    label: "Versioned prompts + guardrails",
    cells: [false, true, false, false],
  },
  { label: "On-device vector search", cells: [false, false, true, true] },
  { label: "Privacy gate (no-egress)", cells: [false, false, true, false] },
  {
    label: "Governed-agent kernel + sandboxed runner",
    cells: [false, false, false, true],
  },
];

/** The starting-price row — /pricing appends this after the feature rows; the home teaser omits it. */
export const SKU_PRICE_ROW: SkuRow = {
  label: "Starting price",
  cells: [
    editionPrice("compliance"),
    editionPrice("ai-kit"),
    editionPrice("local-first"),
    editionPrice("agentic-dev"),
  ],
};

// ---- /build configurator: compose-a-stack running total + upgrade nudge (ADR-0191) ----
// The math that proves the "compose, don't fork" thesis: pick modules, see the live total, and get
// nudged toward the edition or bundle that covers the same modules for less. Pure + integer USD
// (money is never a float, ADR-0007) so it is unit-tested and shared by /build and the cart.

/** The single best "buy this instead and save" offer for a set of selected modules. */
export interface StackUpgrade {
  /** An edition slug or `"bundle"`. */
  target: EditionId | "bundle";
  /** Display label, e.g. "Compliance edition" or "Everything bundle". */
  label: string;
  /** The target's committed price (integer USD). */
  price: number;
  /** How much the buyer saves vs the à-la-carte total (> 0; else no offer is returned). */
  saves: number;
}

/** A composed à-la-carte stack: its line items, running total, and the best upgrade offer. */
export interface StackSummary {
  lineItems: readonly ModulePrice[];
  moduleCount: number;
  /** Sum of the selected module prices, integer USD. */
  total: number;
  /** Present only when an edition or the bundle costs strictly less than the à-la-carte total. */
  upgrade?: StackUpgrade;
}

/** The cheapest covering upgrade (edition if the selection is single-edition, else/also the bundle),
 *  or `undefined` if buying à la carte is already the cheapest path. */
function bestStackUpgrade(
  lineItems: readonly ModulePrice[],
  total: number,
): StackUpgrade | undefined {
  // An upgrade offer is a COVERAGE claim ("this includes your selection for less"), so a
  // standalone-only module (granted by no edition, and hence not by the bundle) disqualifies the
  // whole selection — otherwise the nudge sells an upgrade that silently drops a module.
  if (lineItems.some((m) => m.standaloneOnly)) return undefined;
  const offers: StackUpgrade[] = [];
  // Single-edition selection → the whole edition (which includes these modules and more) may cost
  // less than buying them separately.
  const editions = new Set(lineItems.map((m) => m.edition));
  if (editions.size === 1) {
    const [edition] = [...editions] as [EditionId];
    const anchor = priceById(edition);
    if (anchor && anchor.amount != null && anchor.amount < total) {
      offers.push({
        target: edition,
        label: `${anchor.label} edition`,
        price: anchor.amount,
        saves: total - anchor.amount,
      });
    }
  }
  // The everything bundle — relevant once a cross-edition selection outgrows the bundle price.
  const bundle = priceById("bundle");
  if (bundle && bundle.amount != null && bundle.amount < total) {
    offers.push({
      target: "bundle",
      label: bundle.label,
      price: bundle.amount,
      saves: total - bundle.amount,
    });
  }
  if (offers.length === 0) return undefined;
  return offers.reduce((best, o) => (o.saves > best.saves ? o : best));
}

/** Summarize a selected set of module ids into a running total + the best upgrade nudge. Unknown or
 *  duplicate ids are ignored (each SKU is a one-time license, never a quantity). */
export function buildStackSummary(moduleIds: readonly string[]): StackSummary {
  const ids = new Set(moduleIds);
  const lineItems = MODULE_PRICES.filter((m) => ids.has(m.id));
  const total = lineItems.reduce((sum, m) => sum + m.amount, 0);
  const upgrade = bestStackUpgrade(lineItems, total);
  return {
    lineItems,
    moduleCount: lineItems.length,
    total,
    ...(upgrade ? { upgrade } : {}),
  };
}
