// Committed pricing — the six-bundle catalog (ADR-0257 vocabulary · ADR-0258 numbers; the W7.2
// display flip retired the edition sheet this file carried through the catalog rework). Shown as
// the prices — NO "subject to change" hedge. The operator may still adjust a final number before
// checkout goes live, but the site no longer says so. Amounts are integer USD (money is never a
// float, ADR-0007). Single source — pages, SKU grid, cart, and JSON-LD Offers all read from here
// so a number never drifts between surfaces.
//
// Honesty floor (ADR-0130): the site was NEVER live at any earlier number, so a struck-through
// "was $X now $Y" per-bundle or per-module anchor would imply a price no customer ever paid — a
// fabricated discount the guardrails module itself forbids (FTC 4Ps). There is therefore NO
// per-anchor compare/"was" price on this sheet. The ONE truthful comparison kept is the Everything
// bundle's saving vs the live à-la-carte catalog subtotal (`everythingSavings()`) — a real saving,
// not an invented price history. Every bundle is a real buyable product (no "roadmap" gating), and
// the per-module offering is a REAL catalog (`MODULE_PRICES`), not a single "from $49" placeholder
// line.

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

/** The locked bundle-vocabulary id set (ADR-0257 §1 / ADR-0258) — the personas + Provenance + the
 *  full-catalog Everything bundle that dissolve the four editions. Kept as a SITE-LOCAL const (not an
 *  import from `@caisson/registry-schema`) on purpose: this module is client-reachable, and pulling
 *  registry-schema drags in its `node:fs` disk loader. `pricing.test.ts` pins these values against
 *  the shared `BUNDLE_IDS` in registry-schema so they can't drift. */
export const BUNDLE_IDS = [
  "compliance",
  "ai-production",
  "local-first",
  "agentic-dev",
  "provenance",
  "everything",
] as const;
export type BundleId = (typeof BUNDLE_IDS)[number];

export function isBundleId(id: string): id is BundleId {
  return (BUNDLE_IDS as readonly string[]).includes(id);
}

/** The persona/Provenance bundles a module can be a member of — every bundle except the whole-catalog
 *  `everything`, which contains every sellable SKU by construction (ADR-0258) and so is never listed
 *  on a per-module `bundles[]`. */
export const PERSONA_BUNDLE_IDS = BUNDLE_IDS.filter(
  (b): b is Exclude<BundleId, "everything"> => b !== "everything",
);

/** The six bundles, in display order (ADR-0257 vocabulary · ADR-0258 numbers). These are the
 *  editions' successors: the four personas (Compliance, AI-Production, Local-first, Agentic-Dev) plus
 *  net-new Provenance and the whole-catalog Everything. Amounts are integer USD (money is never a
 *  float, ADR-0007) and every one is pinned to `@caisson/pricebook`'s `BUNDLE_RETAIL` by
 *  `pricing.test.ts` (the locked retail truth — never hand-invented here) and asserted below the sum
 *  of its priced members (the 0.75× below-sum lock, ADR-0258 §Consequences). */
export const BUNDLE_PRICES: readonly (PriceAnchor & { id: BundleId })[] = [
  {
    id: "compliance",
    label: "Compliance",
    amount: 1449,
    unit: "once",
    from: false,
    note: "The compliance wedge: fail-closed RLS, WORM, an audit chain, evidence packs, access reviews, the AI risk register, a buyer trust page, and the framework + signing carves.",
  },
  {
    id: "ai-production",
    label: "AI-Production",
    amount: 739,
    unit: "once",
    from: false,
    note: "The production-rigor layer for AI features: metering, guardrails, prompt versioning, and the CI eval harness.",
  },
  {
    id: "local-first",
    label: "Local-first",
    amount: 629,
    unit: "once",
    from: false,
    note: "On-device inference, a privacy egress gate, and local vector search — your data never leaves the device.",
  },
  {
    id: "agentic-dev",
    label: "Agentic-Dev",
    amount: 329,
    unit: "once",
    from: false,
    note: "The governed-agent kernel: typed agent/skill/rule schema, a guarded lifecycle, and sandboxed execution.",
  },
  {
    id: "provenance",
    label: "Provenance",
    amount: 399,
    unit: "once",
    from: false,
    note: "Cryptographic provenance: detached signing, an append-only WORM audit chain, and per-tenant field encryption.",
  },
  {
    id: "everything",
    label: "Everything",
    amount: 2059,
    unit: "once",
    from: false,
    note: "The full catalog — every bundle and every à-la-carte module, one purchase.",
  },
] as const;

/** Every module sold à la carte. Prices are the locked $49-$299 band (pricebook `SKU_RETAIL`). */
export interface ModulePrice {
  /** Slug — the cart key and the Plausible event prop. */
  id: string;
  label: string;
  /** Integer USD, one-time. */
  amount: number;
  /**
   * The bundles this module is a member of (1:N — a module can belong to several, e.g. field-crypto
   * spans Compliance, AI-Production, Local-first, and Provenance). This is the MEMBERSHIP TRUTH:
   * every id here is pinned by `pricing.test.ts` against the bundle's registry-index `members` map
   * (registry members maps are the only membership truth), and the standards-gate catalog↔manifest
   * parity check enforces the same. Persona/Provenance ids only — `everything` is never listed (it
   * contains every sellable SKU by construction, ADR-0258). An empty array = a module no bundle
   * grants (a genuinely standalone SKU).
   */
  bundles: readonly BundleId[];
  /** Customer-facing benefit, one line — not the internal package README description. */
  blurb: string;
}

export const MODULE_PRICES: readonly ModulePrice[] = [
  // Every sellable commercial SKU, individually priced (ADR-0246 F1b). `bundles` is the
  // index-pinned membership (pricing.test.ts); sections below are display grouping only.
  // ---- Compliance ----
  {
    id: "field-crypto",
    label: "Field encryption",
    amount: 199,
    bundles: ["compliance", "ai-production", "local-first", "provenance"],
    blurb:
      "Per-tenant field encryption (HKDF-SHA256): each tenant's ciphertext is sealed under its own derived key, and a cross-tenant read fails to decrypt in the test suite, every run.",
  },
  {
    id: "audit-worm",
    label: "Audit chain + WORM",
    amount: 149,
    bundles: ["compliance", "provenance"],
    blurb:
      "Append-only SHA-256 audit chain plus S3 Object-Lock WORM evidence storage. Tamper breaks the link.",
  },
  {
    id: "retention-runner",
    label: "Retention runner",
    amount: 199,
    bundles: ["compliance"],
    blurb:
      "Policy-driven data retention on a schedule: expiry and legal-hold, enforced automatically.",
  },
  {
    // Compliance membership because that is the bundle that composes @caisson/alerting
    // (packages/compliance dependency; ADR-0205).
    id: "alerting",
    label: "Alert pipeline",
    amount: 149,
    bundles: ["compliance"],
    blurb:
      "Deduped, rate-capped alert delivery with quiet hours and an audit trail: the SOC 2 CC7.2 alerting control your compliance program can point to.",
  },
  // Compliance-gap SKUs (first prices, the 2026-07-20 pricing round).
  {
    id: "access-review",
    label: "Access reviews",
    amount: 199,
    bundles: ["compliance"],
    blurb:
      "Audit-prep access-review campaigns: import a membership snapshot, record per-reviewee attested approve/revoke decisions into the WORM log, and close with every undecided reviewee flagged — never auto-approved.",
  },
  {
    id: "risk-register",
    label: "AI risk register",
    amount: 279,
    bundles: ["compliance"],
    blurb:
      "Likelihood x impact risk scoring with a computed residual, operator overrides recorded as chained exceptions, crosswalks into your framework packs, and a treatment-plan evidence artifact.",
  },
  {
    id: "trust-page",
    label: "Trust page",
    amount: 149,
    bundles: ["compliance"],
    blurb:
      "A self-contained trust page built from your evidence pack through allowlist-based redaction: host it anywhere to show prospects your compliance posture.",
  },
  // ---- AI Production Kit ----
  {
    id: "ai-meter",
    label: "Token metering",
    amount: 199,
    bundles: ["ai-production"],
    blurb:
      "PG-atomic token metering with per-tenant spend caps and a circuit breaker that trips before a runaway prompt loop reaches your invoice.",
  },
  {
    // The ADR-0258 fold-in: ai-evals joined the ai-production bundle members at the members-fold
    // republish (it was never in the legacy ai-kit edition map).
    id: "ai-evals",
    label: "Eval harness",
    amount: 199,
    bundles: ["ai-production"],
    blurb:
      "Regression-grade evals that run in CI, ahead of production. A model swap that regresses fails the build, catching it before a customer's session does.",
  },
  {
    id: "guardrails",
    label: "Guardrails",
    amount: 149,
    bundles: ["ai-production"],
    blurb:
      "A single guardrail boundary between your app and the model: every call passes through the same PII redaction, moderation, and secret-shape gate.",
  },
  {
    id: "prompt-registry",
    label: "Prompt registry",
    amount: 99,
    bundles: ["ai-production"],
    blurb:
      "Versioned prompts with rollout history: promote or roll back a prompt by moving an alias pointer, no redeploy required.",
  },
  // ---- Local-first AI ----
  {
    id: "local-store",
    label: "Local vector store",
    amount: 99,
    bundles: ["local-first", "agentic-dev"],
    blurb:
      "Hybrid FTS5 + sqlite-vec search that runs on disk, one file per tenant, with no vector-cloud vendor in the loop.",
  },
  // ---- Agentic-Dev ----
  {
    id: "agent-kernel",
    label: "Agent kernel",
    amount: 199,
    bundles: ["agentic-dev"],
    blurb:
      "Typed agent/skill/rule schema plus the guarded lifecycle state machine: a failed VERIFY reopens PLAN, and the only path to SHIP runs back through it.",
  },
  {
    id: "agent-runner",
    label: "Agent runner",
    amount: 49,
    bundles: ["agentic-dev"],
    blurb:
      "Sandboxed, governed agent execution: spawn a headless coding agent into an isolated worktree and stream back an auditable transcript, with the child's environment built from scratch rather than inherited.",
  },
  {
    id: "agent-trajectory",
    label: "Agent trajectory",
    amount: 49,
    bundles: ["agentic-dev"],
    blurb:
      "The governed run record: an append-only, replayable event log of every agent step, tool proposal, approval, and spend — sensitive bodies referenced by digest, paused runs encrypted at rest, and a deterministic replay for scoring and audit.",
  },
  // ---- Catalog-rework carve + standalone SKUs (ADR-0257/0258/0260) ----
  // Prices are the @caisson/pricebook `SKU_RETAIL` truth (pinned by pricing.test.ts); `bundles[]`
  // is the registry members-map membership (pinned bidirectionally).
  // ---- Compliance carves ----
  {
    id: "compliance-core",
    label: "Compliance core",
    amount: 299,
    bundles: ["compliance"],
    blurb:
      "The fail-closed compliance substrate: the RLS-force evidence collector, isolation tests, and the SOC 2 / HIPAA evidence-pack generator that maps live controls to named clauses.",
  },
  {
    id: "frameworks-pack",
    label: "Frameworks pack",
    amount: 249,
    bundles: ["compliance"],
    blurb:
      "The framework control library: SOC 2, HIPAA, and EU AI Act mappings with OSCAL v1.2.2 export — the clause-to-control catalog the evidence packs render against.",
  },
  {
    id: "signing-primitive",
    label: "Signing primitive",
    amount: 199,
    bundles: ["compliance", "provenance"],
    blurb:
      "Detached Ed25519 + RFC-3161 signing over evidence bundles and audit roots: a verifiable signature a third party can check without your keys.",
  },
  // ---- AI-Production ----
  {
    id: "credits",
    label: "Credits + metering",
    amount: 149,
    bundles: ["ai-production"],
    blurb:
      "PG-atomic credit ledger with one integer denomination: grant, debit, and spend-cap credits across codegen and AI features, fail-closed on an empty balance (402).",
  },
  // ---- Local-first carves ----
  {
    id: "local-sync",
    label: "Local sync engine",
    amount: 199,
    bundles: ["local-first"],
    blurb:
      "Two-way offline sync: changesets, tombstones, a logical clock, and a reconcile pass with a convergence test — the device catches up without a server round-trip.",
  },
  {
    id: "local-inference",
    label: "On-device inference",
    amount: 249,
    bundles: ["local-first"],
    blurb:
      "The InferenceBackend seam over a MiniLM-class ONNX model via transformers.js, SHA-256 hash-verified before use — inference on-device by default, hosted only by opt-in.",
  },
  {
    id: "local-privacy",
    label: "Privacy egress gate",
    amount: 99,
    bundles: ["local-first"],
    blurb:
      "A default-deny egress boundary every payload crosses before it can leave the process: no host is reachable unless a typed allowlist names it — leave it empty and egress is zero.",
  },
  {
    id: "tool-exec",
    label: "Tool-exec gate",
    amount: 99,
    bundles: ["agentic-dev"],
    blurb:
      "The governed tool-execution gate: a default-deny allowlist over Zod-strict argv schemas and execFile arg-arrays — an agent reaches only the commands you explicitly allowed, never a shell.",
  },
  // ---- Platform / standalone commercial SKUs (in Everything, no persona bundle) ----
  {
    id: "org-controls",
    label: "Org controls",
    amount: 249,
    bundles: [],
    blurb:
      "WorkOS SSO plus the owner-gated multi-user surface: invite and manage account members, and the admin-write RLS layer that lets an owner mutate scoped tenant data under a dual-logged policy.",
  },
  {
    id: "billing-orchestration",
    label: "Billing orchestration",
    amount: 99,
    bundles: [],
    blurb:
      "The multi-provider billing engine: Paddle, Stripe, LemonSqueezy, and Polar behind one BillingProvider port, with idempotent webhook fulfillment and a domain event stream.",
  },
  {
    id: "ui-pro",
    label: "UI Pro",
    amount: 129,
    bundles: [],
    blurb:
      "The premium component layer on the open @caisson/ui base: the pricing SKU matrix, buy rails, credential strips, and the elevation + glow treatments the brand system ships.",
  },
] as const;

/** Every module that is a member of `bundle` (1:N — a module appears under each bundle it belongs
 *  to), in catalog order. Membership is the index-pinned `bundles[]` (pricing.test.ts); the hub
 *  bundle cards, persona pages, and the /build configurator all render from this. */
export function modulesByBundle(bundle: BundleId): readonly ModulePrice[] {
  return MODULE_PRICES.filter((m) => m.bundles.includes(bundle));
}

/** A module's committed price (integer USD) by id — throws on an unknown id rather than rendering a
 *  silent $0, so a copy string that names a module can read its price from the SOT and can never
 *  drift. */
export function moduleAmount(id: string): number {
  const m = MODULE_PRICES.find((x) => x.id === id);
  if (m === undefined) throw new Error(`unknown module id: ${id}`);
  return m.amount;
}

/** The cheapest module in the whole catalog — the real floor of the "from $X" per-module anchor
 *  below (computed, never hand-duplicated, so the two numbers can't drift). */
const MODULE_MIN_AMOUNT = Math.min(...MODULE_PRICES.map((m) => m.amount));

/** A bundle's display anchor from `BUNDLE_PRICES` (ADR-0257/0258). Kept SEPARATE from `priceById`
 *  (the subscription-plan lookup) so a one-time bundle can never shadow a plan row. */
export function bundlePriceById(id: BundleId): PriceAnchor | undefined {
  return BUNDLE_PRICES.find((b) => b.id === id);
}

/** À-la-carte subtotal of every sellable SKU (the real "buy each module separately" baseline). */
export function moduleCatalogSubtotal(): number {
  return MODULE_PRICES.reduce((sum, m) => sum + m.amount, 0);
}

/** À-la-carte subtotal of a persona bundle's priced member modules — the real "buy the members
 *  separately" baseline the bundle price sits below (the 0.75x below-sum lock, ADR-0258). Everything
 *  has no per-module `bundles[]` members (it is the whole catalog), so use `moduleCatalogSubtotal`. */
export function bundleModuleSubtotal(bundle: BundleId): number {
  return modulesByBundle(bundle).reduce((sum, m) => sum + m.amount, 0);
}

/** What the Everything bundle saves vs buying every à-la-carte module separately, in whole USD —
 *  a REAL saving against the live catalog subtotal (never a fabricated price history, ADR-0130).
 *  Clamped at 0 in case a future reprice ever inverts the below-sum math. */
export function everythingSavings(): number {
  const everything = bundlePriceById("everything");
  if (!everything || everything.amount === null) return 0;
  return Math.max(0, moduleCatalogSubtotal() - everything.amount);
}

/** Updates-renewal rate: a 12-month per-entitlement renewal costs a flat 40% of the
 *  then-current list price, floored to the nearest X9 price point (ADR-0260 §5 ladder:
 *  $199→$79 · $149→$59 · $129→$49 · $99→$39 · $49→$19). The Paddle renewal price rows carry
 *  the exact cents `renewalAmount` yields — display and charge never drift. */
export const RENEWAL_RATE_PERCENT = 40;

/** Renewal display price for a purchased entitlement id (module or bundle), whole USD.
 *  Returns null for ids with no list price (unknown/legacy ids stay number-free — the Paddle
 *  overlay remains the authoritative display for those, never a fabricated figure, ADR-0130). */
export function renewalAmount(entitlementId: string): number | null {
  const list =
    MODULE_PRICES.find((m) => m.id === entitlementId)?.amount ??
    BUNDLE_PRICES.find((b) => b.id === entitlementId)?.amount ??
    null;
  if (list === null) return null;
  // Flat 40%, then floor to the nearest whole-dollar point ending in 9 (X9, ADR-0260 §5).
  // Closed-form: below $9 no X9 point exists (a sub-$23 list price), so stay number-free —
  // the Paddle overlay remains the authoritative display for such a row (ADR-0130).
  const n = Math.floor((list * RENEWAL_RATE_PERCENT) / 100);
  return n < 9 ? null : n - ((n - 9) % 10);
}

/** Multi-year renewal display price (R6 rider — mechanism only, no baked discount or displayed
 *  SKU: the operator sets `discountBps` and picks which SKUs get a multi-year row at SHIP).
 *  `base` is the SKU's 1-year renewal price (`renewalAmount`'s output, whole USD); `years` the
 *  tenor bought at once; `discountBps` the extra basis-points-off-the-naive-total the operator
 *  commits — REQUIRED, never defaulted, so no discount number ships without an explicit call-site
 *  value. Floors the discounted total to the nearest whole dollar ending in 9 (same
 *  floor-to-nearest-X9 convention as `renewalAmount`, so a multi-year price never breaks the
 *  site's ladder aesthetic) and returns null below the $9 floor — same number-free posture as
 *  `renewalAmount` for an input too small to reach an X9 point. */
export function multiYearRenewalAmount(
  base: number,
  years: number,
  discountBps: number,
): number | null {
  // Fail-closed on any non-finite or negative input (the !(x >= bound) NaN-safe form): a NaN or a
  // negative-discount typo must yield null, never a NaN price or a silently inflated one.
  if (
    !(Number.isFinite(base) && Number.isFinite(years)) ||
    !(discountBps >= 0 && discountBps <= 10_000)
  ) {
    return null;
  }
  const naive = base * years;
  const n = Math.floor((naive * (10_000 - discountBps)) / 10_000);
  return !(n >= 9) ? null : n - ((n - 9) % 10);
}

/** Priority-support response-time commitment (ADR-0278 Track K, price-agnostic plumbing, fifth-sitting
 *  picker 2026-07-07): the ONE config source every surface describing the SKU reads from, so the
 *  number never drifts and — while `null` — never invents one. Operator-owned: `null` until the
 *  response-time terms are locked alongside the price (ADR-0278 §Decision — "Price and SLA numbers
 *  are operator-owned"). A plain business-days/hours STRING, not a numeric field, so it can carry
 *  best-effort framing without a formatter re-inventing the wording. */
export const PRIORITY_SUPPORT_RESPONSE_TIME: string | null = null;

/** Honest response-time line for the priority-support SKU (ADR-0278: response-time, not resolution-
 *  time; business-days phrasing; never the word "SLA" — that implies a contractual remedy this
 *  one-person operation doesn't commit to). `null` config renders a plain unset line rather than a
 *  fabricated number (the same no-placeholder discipline the price itself follows). No live site page
 *  renders this SKU yet (ADR-0278 Consequences: the pricing page's existing support-responsiveness
 *  line keeps describing the included tier only until this SKU ships a price) — `services/docs`'
 *  `plansDoc` filters this row out of the public RAG corpus by the same `amount === null` gate, for
 *  the identical reason: no invented commitment on a prospect-facing surface. */
export function prioritySupportResponseTimeCopy(): string {
  return PRIORITY_SUPPORT_RESPONSE_TIME === null
    ? "Response-time commitment: unset."
    : `Target response time: ${PRIORITY_SUPPORT_RESPONSE_TIME} (best-effort).`;
}

/** Purchase structures beyond the one-time bundles (`BUNDLE_PRICES` owns those — incl. the
 *  Everything bundle that replaced the retired $1,499 edition-era row). */
export const PLAN_PRICES: readonly PriceAnchor[] = [
  {
    id: "module",
    label: "Per-module",
    amount: MODULE_MIN_AMOUNT,
    unit: "once",
    from: true,
    note: "Take a single module à la carte — 26 standalone modules across the catalog.",
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
    // Priority-support subscription SKU (ADR-0278 Track K, price-agnostic). `amount: null` is a
    // fail-closed GATE, not a display choice: unlike the six bundles / à-la-carte modules, this id is
    // never wired into `catalog.ts`'s `BUNDLE_PRICE_IDS`/`MODULE_PRICE_IDS` cart maps, and it carries
    // no `@caisson/pricebook` PLAN_BOOK row (no real Paddle price id exists — no Paddle product has
    // been created, per the picker lock: no Paddle API calls this track) — so there is no cart entry,
    // no `/dashboard/plan` row (that page reads `PLAN_BOOK` directly), and no webhook resolution path.
    // The operator sets this price AND `PRIORITY_SUPPORT_RESPONSE_TIME` above together before the SKU
    // becomes purchasable anywhere (ADR-0278 §Decision).
    id: "priority-support",
    label: "Priority support",
    amount: null,
    unit: null,
    from: false,
    note: prioritySupportResponseTimeCopy(),
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

/** Lookup a subscription/plan anchor by id (`module`, `compliance-updates`, `developer`,
 *  `enterprise`). One-time bundle anchors live in `bundlePriceById`. */
export function priceById(id: string): PriceAnchor | undefined {
  return PLAN_PRICES.find((p) => p.id === id);
}

/** Formatted price for a plan id, or an em-dash if the id has no anchor. */
export function planPrice(id: string): string {
  const p = priceById(id);
  return p ? formatPrice(p) : "—";
}

/** Formatted price for a bundle id, or an em-dash if the id has no anchor. */
export function bundlePrice(id: BundleId): string {
  const p = bundlePriceById(id);
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

/** Matrix columns — the five persona bundles, in display order (Everything contains every SKU by
 *  construction, so a column for it would be all-true noise). */
export const SKU_COLUMNS = [
  "Compliance",
  "AI-Production",
  "Local-first",
  "Agentic-Dev",
  "Provenance",
] as const;

/** The capability rows (no price row) — the home teaser shows exactly these. A cell is an
 *  INCLUSION claim. The module LIST (`MODULE_PRICES` × `modulesByBundle`) is pinned to the
 *  registry index members maps by the membership lint in pricing.test.ts; these capability CELLS
 *  are hand-maintained against the same registry truth (label-keyed, so not auto-linted) and are
 *  reviewed alongside that lint whenever a bundle's members are repinned. Base capabilities
 *  (Apache-2.0, ship with everything — incl. fail-closed RLS) live on the one base row. */
export const SKU_FEATURE_ROWS: readonly SkuRow[] = [
  {
    label: "Postgres base — fail-closed RLS, auth (Apache-2.0)",
    cells: [true, true, true, true, true],
  },
  {
    label: "RLS-force evidence collector + isolation tests",
    cells: [true, false, false, false, false],
  },
  { label: "WORM evidence store", cells: [true, false, false, false, true] },
  {
    label: "Append-only audit chain",
    cells: [true, false, false, false, true],
  },
  {
    label: "Per-tenant field encryption",
    cells: [true, true, true, false, true],
  },
  {
    label: "Evidence-pack generator + framework mappings",
    cells: [true, false, false, false, false],
  },
  {
    label: "Detached Ed25519 + RFC-3161 evidence signing",
    cells: [true, false, false, false, true],
  },
  {
    label: "Alert pipeline + retention runner",
    cells: [true, false, false, false, false],
  },
  {
    label: "Token metering · spend caps · credit ledger",
    cells: [false, true, false, false, false],
  },
  {
    label: "Versioned prompts + guardrails",
    cells: [false, true, false, false, false],
  },
  {
    label: "CI eval harness",
    cells: [false, true, false, false, false],
  },
  {
    label: "On-device vector search",
    cells: [false, false, true, true, false],
  },
  {
    label: "On-device inference + offline sync",
    cells: [false, false, true, false, false],
  },
  {
    label: "Privacy gate (no-egress)",
    cells: [false, false, true, false, false],
  },
  {
    label: "Governed-agent kernel + sandboxed runner + tool-exec gate",
    cells: [false, false, false, true, false],
  },
];

/** The starting-price row — /pricing appends this after the feature rows; the home teaser omits it. */
export const SKU_PRICE_ROW: SkuRow = {
  label: "Starting price",
  cells: [
    bundlePrice("compliance"),
    bundlePrice("ai-production"),
    bundlePrice("local-first"),
    bundlePrice("agentic-dev"),
    bundlePrice("provenance"),
  ],
};

// ---- /build configurator: compose-a-stack running total + upgrade nudge (ADR-0191) ----
// The math that proves the "compose, don't fork" thesis: pick modules, see the live total, and get
// nudged toward the bundle that covers the same modules for less. Pure + integer USD (money is
// never a float, ADR-0007) so it is unit-tested and shared by /build and the cart.

/** The single best "buy this instead and save" offer for a set of selected modules. */
export interface StackUpgrade {
  /** The covering bundle's id. */
  target: BundleId;
  /** Display label, e.g. "Compliance bundle" or "Everything bundle". */
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
  /** Present only when a covering bundle costs strictly less than the à-la-carte total. */
  upgrade?: StackUpgrade;
}

/** The best covering-bundle upgrade, or `undefined` if buying à la carte is already the cheapest
 *  path. An upgrade offer is a COVERAGE claim ("this includes your selection for less"): a persona
 *  bundle qualifies only when every selected module's `bundles[]` names it; Everything covers any
 *  selection by construction (the explicit full-catalog rule, ADR-0258). */
function bestStackUpgrade(
  lineItems: readonly ModulePrice[],
  total: number,
): StackUpgrade | undefined {
  const offers: StackUpgrade[] = [];
  for (const bundleId of PERSONA_BUNDLE_IDS) {
    if (!lineItems.every((m) => m.bundles.includes(bundleId))) continue;
    const anchor = bundlePriceById(bundleId);
    if (anchor && anchor.amount != null && anchor.amount < total) {
      offers.push({
        target: bundleId,
        label: `${anchor.label} bundle`,
        price: anchor.amount,
        saves: total - anchor.amount,
      });
    }
  }
  const everything = bundlePriceById("everything");
  if (everything && everything.amount != null && everything.amount < total) {
    offers.push({
      target: "everything",
      label: `${everything.label} bundle`,
      price: everything.amount,
      saves: total - everything.amount,
    });
  }
  if (offers.length === 0) return undefined;
  return offers.reduce((best, o) => (o.saves > best.saves ? o : best));
}

/** Summarize a selected set of module ids into a running total + the best upgrade nudge. Unknown or
 *  duplicate ids are ignored (each SKU is a one-time license, never a quantity). When
 *  `ownedBundleIds` is given (bundles already in the cart), the nudge is suppressed if one of them
 *  already covers every selected module — stacking a second covering bundle would be pure overpay. */
export function buildStackSummary(
  moduleIds: readonly string[],
  ownedBundleIds: readonly string[] = [],
): StackSummary {
  const ids = new Set(moduleIds);
  const lineItems = MODULE_PRICES.filter((m) => ids.has(m.id));
  const total = lineItems.reduce((sum, m) => sum + m.amount, 0);
  const alreadyCovered = ownedBundleIds.some(
    (b) =>
      b === "everything" ||
      lineItems.every((m) => m.bundles.some((covering) => covering === b)),
  );
  const upgrade = alreadyCovered
    ? undefined
    : bestStackUpgrade(lineItems, total);
  return {
    lineItems,
    moduleCount: lineItems.length,
    total,
    ...(upgrade ? { upgrade } : {}),
  };
}
