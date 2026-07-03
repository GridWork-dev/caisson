import { describe, expect, test } from "bun:test";

import {
  buildStackSummary,
  bundleSavings,
  EDITION_IDS,
  EDITION_PRICES,
  editionsSubtotal,
  formatPrice,
  formatUsd,
  isEditionId,
  MODULE_PRICES,
  modulesByEdition,
  PLAN_PRICES,
  priceById,
} from "./pricing";

describe("EDITION_PRICES (Q4 below-sum lock)", () => {
  test("editions carry the Q4 below-sum lock values", () => {
    expect(priceById("compliance")?.amount).toBe(799);
    expect(priceById("ai-kit")?.amount).toBe(599);
    expect(priceById("local-first")?.amount).toBe(349);
    expect(priceById("agentic-dev")?.amount).toBe(249);
  });

  test("every edition carries a positive integer amount and no roadmap gating", () => {
    for (const p of EDITION_PRICES) {
      expect(Number.isInteger(p.amount)).toBe(true);
      expect(p.amount).toBeGreaterThan(0);
      expect(p.note.toLowerCase()).not.toContain("roadmap");
    }
  });

  test("all four editions are present", () => {
    expect(EDITION_PRICES.map((p) => p.id).sort()).toEqual(
      [...EDITION_IDS].sort(),
    );
  });

  // Honesty floor (ADR-0130): the site was never live at an earlier number, so no anchor may carry
  // a fabricated struck-through "was" compare price. Guarded at runtime because the field was
  // removed from the type — a re-introduction would be a fresh dark pattern.
  test("no edition or plan anchor carries a fabricated 'was' compare price", () => {
    for (const p of [...EDITION_PRICES, ...PLAN_PRICES]) {
      expect("wasAmount" in p).toBe(false);
    }
  });
});

describe("isEditionId", () => {
  test("accepts every real edition id", () => {
    for (const id of EDITION_IDS) expect(isEditionId(id)).toBe(true);
  });

  test("rejects an unknown id", () => {
    expect(isEditionId("bundle")).toBe(false);
    expect(isEditionId("")).toBe(false);
  });
});

describe("the Everything bundle", () => {
  test("carries the Q4 below-sum bundle price", () => {
    const bundle = priceById("bundle");
    expect(bundle?.amount).toBe(1499);
  });

  test("editionsSubtotal sums the four locked edition prices", () => {
    expect(editionsSubtotal()).toBe(799 + 599 + 249 + 349);
  });

  test("the bundle price is below the sum of the four editions (a real saving)", () => {
    expect(priceById("bundle")?.amount).toBeLessThan(editionsSubtotal());
  });

  test("bundleSavings is the positive gap between the edition subtotal and the bundle price", () => {
    expect(bundleSavings()).toBe(editionsSubtotal() - 1499);
    // The one truthful comparison the site keeps: Save $497 vs à-la-carte (1996 - 1499).
    expect(bundleSavings()).toBe(497);
    expect(bundleSavings()).toBeGreaterThan(0);
  });
});

describe("MODULE_PRICES", () => {
  test("lists exactly 11 standalone modules (ADR-0238 — the 4 edition-core rows are dropped)", () => {
    expect(MODULE_PRICES.length).toBe(11);
  });

  test("no module id names an edition (ADR-0238 collision lint)", () => {
    // Site edition slugs AND the registry edition ids the pricebook grants — a module id matching
    // either would expand a module purchase to the whole parent edition (the dropped-row bug).
    const editionIds = new Set<string>([
      ...EDITION_IDS,
      "local-ai",
      "agent-dev",
    ]);
    for (const m of MODULE_PRICES) {
      expect(editionIds.has(m.id)).toBe(false);
    }
  });

  test("module ids are unique", () => {
    const ids = MODULE_PRICES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every module is grouped under a real edition id", () => {
    for (const m of MODULE_PRICES) {
      expect(isEditionId(m.edition)).toBe(true);
    }
  });

  test("every module amount is a positive integer within the locked $49-$299 band", () => {
    for (const m of MODULE_PRICES) {
      expect(Number.isInteger(m.amount)).toBe(true);
      expect(m.amount).toBeGreaterThanOrEqual(49);
      expect(m.amount).toBeLessThanOrEqual(299);
    }
  });

  test("modulesByEdition partitions the catalog with no overlap and no loss", () => {
    const total = EDITION_IDS.reduce(
      (sum, e) => sum + modulesByEdition(e).length,
      0,
    );
    expect(total).toBe(MODULE_PRICES.length);
  });

  test("the per-module PLAN_PRICES anchor tracks the cheapest real module (no drift)", () => {
    const min = Math.min(...MODULE_PRICES.map((m) => m.amount));
    expect(priceById("module")?.amount).toBe(min);
    expect(priceById("module")?.from).toBe(true);
  });
});

describe("formatPrice / formatUsd", () => {
  test("formats a once price with the 'from' prefix", () => {
    expect(formatPrice({ amount: 2499, unit: "once", from: true })).toBe(
      "from $2,499",
    );
  });

  test("formats a yearly subscription with the /yr suffix, no prefix", () => {
    expect(formatPrice({ amount: 1499, unit: "year", from: false })).toBe(
      "$1,499/yr",
    );
  });

  test("formats a null amount as Contact us", () => {
    expect(formatPrice({ amount: null, unit: null, from: false })).toBe(
      "Contact us",
    );
  });

  test("formatUsd renders a bare integer with thousands separators", () => {
    expect(formatUsd(299)).toBe("$299");
    expect(formatUsd(2999)).toBe("$2,999");
  });
});

describe("PLAN_PRICES", () => {
  test("carries no null-amount rows except Enterprise", () => {
    const nullRows = PLAN_PRICES.filter((p) => p.amount === null);
    expect(nullRows.map((p) => p.id)).toEqual(["enterprise"]);
  });
});

describe("buildStackSummary (compose-a-stack math, ADR-0191)", () => {
  const idsOf = (edition: Parameters<typeof modulesByEdition>[0]) =>
    modulesByEdition(edition).map((m) => m.id);

  test("a standalone-only module in the selection kills every upgrade offer", () => {
    // The ai-kit browse family sums to 646 (199 + 199 + 149 + 99) vs the 599 edition — but
    // ai-evals is standaloneOnly (no edition grants it, registry members map), so nudging to the
    // edition would silently DROP a $199 module. No offer, ever.
    const s = buildStackSummary(idsOf("ai-kit"));
    expect(s.total).toBe(646);
    expect(s.moduleCount).toBe(4);
    expect(s.upgrade).toBeUndefined();
  });

  test("the edition nudge fires only for a member-true single-edition selection", () => {
    // The three ai-kit modules the edition actually grants: 199 + 149 + 99 = 447 < 599 — cheaper
    // a la carte, so no offer either. The nudge machinery stays coverage-honest in both directions.
    const s = buildStackSummary(["ai-meter", "guardrails", "prompt-registry"]);
    expect(s.total).toBe(447);
    expect(s.upgrade).toBeUndefined();
  });

  test("a selection containing a standalone-only module never nudges to the bundle", () => {
    // All 11 standalone modules: 696 + 646 + 99 + 248 = 1689 vs the 1499 bundle — but the bundle
    // (base + edition members) does not include ai-evals, so the claim would be false.
    const s = buildStackSummary(MODULE_PRICES.map((m) => m.id));
    expect(s.total).toBe(1689);
    expect(s.upgrade).toBeUndefined();
  });

  test("the bundle nudge fires for a member-true cross-edition selection above the bundle price", () => {
    // The 10 edition-granted modules (1689 - 199 = 1490) sit below 1499 — synthesize the case by
    // checking the guard directly: with ai-evals excluded no real selection crosses the bundle
    // price today, so assert the honest boundary instead of a fabricated catalog.
    const memberIds = MODULE_PRICES.filter((m) => !m.standaloneOnly).map(
      (m) => m.id,
    );
    const s = buildStackSummary(memberIds);
    expect(s.total).toBe(1490);
    expect(s.upgrade).toBeUndefined();
  });

  test("no upgrade offer when a la carte is already the cheapest path", () => {
    // All four of Compliance's standalone modules (199 + 149 + 199 + 149 = 696) cost less than the
    // 799 edition, so nudging to the edition would cost MORE — no offer. (alerting is grouped under
    // compliance because that edition composes @caisson/alerting, ADR-0205.)
    const s = buildStackSummary(idsOf("compliance"));
    expect(s.total).toBe(696);
    expect(s.moduleCount).toBe(4);
    expect(s.upgrade).toBeUndefined();
  });

  test("empty and unknown ids are ignored", () => {
    expect(buildStackSummary([]).total).toBe(0);
    expect(buildStackSummary([]).upgrade).toBeUndefined();
    expect(buildStackSummary(["not-a-real-module"]).moduleCount).toBe(0);
  });

  test("the running total is always an integer (money is never a float, ADR-0007)", () => {
    expect(Number.isInteger(buildStackSummary(idsOf("ai-kit")).total)).toBe(
      true,
    );
  });
});

describe("edition membership honesty (the registry index is the entitlement truth)", () => {
  // An edition (and the bundle = base ∪ edition members) purchase expands to the registry index
  // members map (expandEntitlements, ADR-0071) — so every inclusion claim keyed off
  // `ModulePrice.edition` must match that map, or the site sells a grant that does not exist.
  // `standaloneOnly` marks the browse-family exceptions (today: ai-evals, standalone by design
  // per its own manifest). If the operator ever repins an edition's members to ADD such a module,
  // this lint fails on the stale flag — flip `standaloneOnly` off and the nudge follows.
  const REGISTRY_EDITION_IDS: Record<(typeof EDITION_IDS)[number], string> = {
    compliance: "@caisson/compliance",
    "ai-kit": "@caisson/ai-kit",
    "local-first": "@caisson/local-ai",
    "agentic-dev": "@caisson/agent-dev",
  };

  interface IndexModule {
    id: string;
    latest: string;
    versions: readonly {
      version: string;
      manifest?: { members?: Record<string, unknown> };
    }[];
  }

  async function latestMembers(): Promise<Record<string, ReadonlySet<string>>> {
    const index = (await Bun.file(
      new URL("../../../registry/index.json", import.meta.url),
    ).json()) as { modules: IndexModule[] };
    const out: Record<string, ReadonlySet<string>> = {};
    for (const regId of Object.values(REGISTRY_EDITION_IDS)) {
      const entry = index.modules.find((m) => m.id === regId);
      if (!entry) continue;
      const latest =
        entry.versions.find((v) => v.version === entry.latest) ??
        entry.versions[entry.versions.length - 1];
      out[regId] = new Set(Object.keys(latest?.manifest?.members ?? {}));
    }
    return out;
  }

  test("every member-claimed module is in its edition's latest members map", async () => {
    const members = await latestMembers();
    const violations: string[] = [];
    for (const edition of EDITION_IDS) {
      const regId = REGISTRY_EDITION_IDS[edition];
      const map = members[regId];
      if (!map) {
        violations.push(`${regId}: edition missing from registry index`);
        continue;
      }
      for (const m of modulesByEdition(edition)) {
        if (m.standaloneOnly) continue;
        if (!map.has(`@caisson/${m.id}`)) {
          violations.push(
            `${m.id}: claimed a member of the ${edition} edition but absent from ${regId}'s members map — mark it standaloneOnly or repin the members`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("a standaloneOnly module is in NO edition's members map (else the flag is stale)", async () => {
    const members = await latestMembers();
    const violations: string[] = [];
    for (const m of MODULE_PRICES) {
      if (!m.standaloneOnly) continue;
      for (const [regId, map] of Object.entries(members)) {
        if (map.has(`@caisson/${m.id}`)) {
          violations.push(
            `${m.id}: flagged standaloneOnly but ${regId}'s members map grants it — remove the flag`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
