// Committed pricing (ADR-0082, supersedes ADR-0081's indicative frame; point-values from the
// ADR-0012 ranges). Shown as the prices — NO "subject to change" hedge. The operator may still
// adjust a final number before checkout goes live, but the site no longer says so. Amounts are
// integer USD (money is never a float, ADR-0007). All four editions are commercial (ADR-0083 made
// Local-first commercial — no free/AGPL tier). Single source — pages, SKU grid, and JSON-LD Offers
// all read from here so a number never drifts between surfaces.

export interface PriceAnchor {
  /** Stable id (also the JSON-LD Offer key). */
  id: string;
  /** Display name. */
  label: string;
  /** Integer USD. `null` is unused — all editions are commercial (ADR-0083), kept for the formatPrice fallback. */
  amount: number | null;
  /** Billing unit. `once` = one-time perpetual; `month` = subscription. */
  unit: "once" | "month" | null;
  /** Render as "from $X" (entry price of a range). */
  from: boolean;
  /** One-line position note. */
  note: string;
}

/** The four editions. Compliance is the hero anchor; all four are commercial (ADR-0083). */
export const EDITION_PRICES: readonly PriceAnchor[] = [
  {
    id: "compliance",
    label: "Compliance",
    amount: 1299,
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
    note: "The governed-agent kernel. Roadmap edition.",
  },
  {
    id: "local-first",
    label: "Local-first AI",
    amount: 499,
    unit: "once",
    from: true,
    note: "Own the source. On-device inference, a privacy gate, and vector search — your data never leaves the device.",
  },
] as const;

/** Purchase structures beyond single editions. */
export const PLAN_PRICES: readonly PriceAnchor[] = [
  {
    id: "bundle",
    label: "Everything bundle",
    amount: 2499,
    unit: "once",
    from: false,
    note: "All editions plus the base, one purchase.",
  },
  {
    id: "module",
    label: "Per-module",
    amount: 49,
    unit: "once",
    from: true,
    note: "Take a single module à la carte.",
  },
  {
    id: "compliance-updates",
    label: "Compliance Updates",
    amount: 199,
    unit: "month",
    from: false,
    note: "Framework updates, evidence-pack refreshes, private-registry pulls.",
  },
  {
    id: "developer",
    label: "Developer plan",
    amount: 99,
    unit: "month",
    from: false,
    note: "Credits, updates, and private-registry access for active builders.",
  },
] as const;

/** Render an anchor as a display string, e.g. "from $1,299", "$199/mo", "Free". */
export function formatPrice(
  p: Pick<PriceAnchor, "amount" | "unit" | "from">,
): string {
  if (p.amount === null) return "Free";
  const money = `$${p.amount.toLocaleString("en-US")}`;
  const suffix = p.unit === "month" ? "/mo" : "";
  return `${p.from ? "from " : ""}${money}${suffix}`;
}

/** Lookup by id across both tables. */
export function priceById(id: string): PriceAnchor | undefined {
  return [...EDITION_PRICES, ...PLAN_PRICES].find((p) => p.id === id);
}
