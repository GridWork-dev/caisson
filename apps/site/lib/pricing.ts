// Indicative pre-launch pricing anchors (ADR-0081, supersedes ADR-0048). Shown WITH the
// "subject to change" frame everywhere they render — the FINAL numbers + grandfathering policy
// stay the operator's open fork. Amounts are integer USD (money is never a float, ADR-0007);
// `null` amount = free. This is the single source — pages, the SKU grid, and JSON-LD Offers all
// read from here so a number never drifts between surfaces.

export const PRICING_DISCLAIMER =
  "Indicative pricing — subject to change before launch.";

export const PRICING_DISCLAIMER_SHORT = "Subject to change before launch.";

export interface PriceAnchor {
  /** Stable id (also the JSON-LD Offer key). */
  id: string;
  /** Display name. */
  label: string;
  /** Integer USD; null = free (AGPL). */
  amount: number | null;
  /** Billing unit. `once` = one-time perpetual; `month` = subscription; null = free. */
  unit: "once" | "month" | null;
  /** Render as "from $X" (entry price of a range). */
  from: boolean;
  /** One-line position note. */
  note: string;
}

/** The four editions. Compliance is the hero anchor; Local-first is free (AGPL). */
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
    amount: null,
    unit: null,
    from: false,
    note: "Open-core under AGPL. Your data never leaves the device.",
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
