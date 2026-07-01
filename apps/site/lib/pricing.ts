// Committed pricing (ADR-0106 LOCKED numbers — supersedes the ADR-0082/ADR-0012-range point
// values this file shipped with pre-P6). Shown as the prices — NO "subject to change" hedge. The
// operator may still adjust a final number before checkout goes live, but the site no longer
// says so. Amounts are integer USD (money is never a float, ADR-0007). All four editions are
// commercial (ADR-0083 made Local-first commercial — no free/AGPL tier). Single source — pages,
// SKU grid, cart, and JSON-LD Offers all read from here so a number never drifts between
// surfaces.
//
// Storefront-rework pass (STORE-FE track): Local-first AI and the Everything bundle are
// REPRICED ($399, was $499; $2,999, was $3,499) and every edition is now a real buyable product —
// Agentic-Dev's "roadmap" framing is retired (the site shows the full catalog as-if-built, subject
// to change, per the operator's go-live posture lock). The per-module offering is now a REAL
// catalog (`MODULE_PRICES`) instead of a single "from $49" placeholder line.

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
  /** Previous display price, when this anchor was just repriced — a UI can render it struck
   *  through next to `amount` as a "was $X" compare price. `undefined`/`null` = no change to show. */
  wasAmount?: number | null;
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
    amount: 2499,
    unit: "once",
    from: true,
    note: "Own the source. Fail-closed RLS, WORM, audit chain, evidence packs.",
  },
  {
    id: "ai-kit",
    label: "AI Production Kit",
    amount: 599,
    unit: "once",
    from: true,
    note: "The production-rigor layer cheap AI boilerplate skips.",
  },
  {
    id: "agentic-dev",
    label: "Agentic-Dev",
    amount: 499,
    unit: "once",
    from: true,
    note: "The governed-agent kernel — typed agent/skill/rule schema, a guarded lifecycle, and a hooks dispatcher.",
  },
  {
    id: "local-first",
    label: "Local-first AI",
    amount: 399,
    unit: "once",
    from: true,
    note: "Own the source. On-device inference, a privacy gate, and vector search — your data never leaves the device.",
    wasAmount: 499,
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
}

export const MODULE_PRICES: readonly ModulePrice[] = [
  // ---- Compliance ----
  {
    id: "compliance",
    label: "Compliance core",
    amount: 299,
    edition: "compliance",
    blurb:
      "Fail-closed Postgres RLS (FORCE) and cross-tenant isolation tests — the substrate every other compliance module composes onto.",
  },
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
    id: "ai-evals",
    label: "Eval harness",
    amount: 199,
    edition: "ai-kit",
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
  {
    id: "ai-kit",
    label: "Agent-setup config bundles",
    amount: 149,
    edition: "ai-kit",
    blurb:
      "Provider-agnostic AI config, one seam over every model you call — swap providers without a rewrite.",
  },
  {
    id: "alerting",
    label: "Spend alerting",
    amount: 149,
    edition: "ai-kit",
    blurb:
      "Threshold alerts on token spend and error rate, wired to the channel you already watch.",
  },
  // ---- Local-first AI ----
  {
    id: "local-ai",
    label: "On-device inference",
    amount: 299,
    edition: "local-first",
    blurb:
      "The compute seam — same code, on-device or hosted, behind a default-deny privacy gate. Sovereignty is the default.",
  },
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
    id: "agent-dev",
    label: "Dev-loop tooling",
    amount: 99,
    edition: "agentic-dev",
    blurb:
      "The hooks dispatcher and local hybrid memory that wire a governed agent into your existing dev loop.",
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
    amount: 2999,
    unit: "once",
    from: false,
    note: "All four editions plus the base, one purchase.",
    wasAmount: 3499,
  },
  {
    id: "module",
    label: "Per-module",
    amount: MODULE_MIN_AMOUNT,
    unit: "once",
    from: true,
    note: "Take a single module à la carte — 14 modules across the four editions.",
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
