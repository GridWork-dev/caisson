import { describe, expect, test } from "bun:test";

import {
  BUNDLE_RETAIL,
  creditableMembers,
  SKU_RETAIL,
} from "@caisson/pricebook";

import {
  buildStackSummary,
  BUNDLE_IDS,
  type BundleId,
  BUNDLE_PRICES,
  bundlePriceById,
  formatPrice,
  formatUsd,
  MODULE_PRICES,
  moduleCatalogSubtotal,
  modulesByBundle,
  multiYearRenewalAmount,
  PERSONA_BUNDLE_IDS,
  PLAN_PRICES,
  priceById,
  PRIORITY_SUPPORT_RESPONSE_TIME,
  prioritySupportResponseTimeCopy,
  renewalAmount,
} from "./pricing";

describe("MODULE_PRICES", () => {
  test("covers exactly the sellable SKU set (ADR-0246 F1b) at the pricebook SKU_RETAIL price", () => {
    // The catalog-rework flip requires every sellable commercial SKU individually priced + visible.
    // The site MODULE_PRICES catalog must therefore be exactly `@caisson/pricebook`'s SKU_RETAIL
    // keyset — no missing SKU (an unpriced product) and no extra (a phantom listing) — and each
    // display price must equal the locked retail (never hand-invented here).
    const siteIds = MODULE_PRICES.map((m) => m.id).sort();
    const retailIds = Object.keys(SKU_RETAIL).sort();
    expect(siteIds).toEqual(retailIds);
    for (const m of MODULE_PRICES) {
      expect(m.amount).toBe(SKU_RETAIL[m.id] ?? -1);
    }
  });

  test("no module id names a bundle or a legacy edition id (entitlement-collision lint)", () => {
    // A module id matching a bundle id (or a legacy edition/bundle-sentinel alias) would collide in
    // the bare-slug entitlement vocabulary and expand a module purchase to the whole bundle — the
    // ADR-0238 dropped-row bug, generalized to the ADR-0257 vocabulary.
    const reserved = new Set<string>([
      ...BUNDLE_IDS,
      "ai-kit",
      "local-ai",
      "agent-dev",
      "bundle",
    ]);
    for (const m of MODULE_PRICES) {
      expect(reserved.has(m.id)).toBe(false);
    }
  });

  test("module ids are unique", () => {
    const ids = MODULE_PRICES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every module amount is a positive integer within the locked $49-$299 band", () => {
    for (const m of MODULE_PRICES) {
      expect(Number.isInteger(m.amount)).toBe(true);
      expect(m.amount).toBeGreaterThanOrEqual(49);
      expect(m.amount).toBeLessThanOrEqual(299);
    }
  });

  test("the per-module PLAN_PRICES anchor tracks the cheapest real module (no drift)", () => {
    const min = Math.min(...MODULE_PRICES.map((m) => m.amount));
    expect(priceById("module")?.amount).toBe(min);
    expect(priceById("module")?.from).toBe(true);
  });

  // Honesty floor (ADR-0130): the site was never live at an earlier number, so no anchor may carry
  // a fabricated struck-through "was" compare price. Guarded at runtime because the field was
  // removed from the type — a re-introduction would be a fresh dark pattern.
  test("no bundle or plan anchor carries a fabricated 'was' compare price", () => {
    for (const p of [...BUNDLE_PRICES, ...PLAN_PRICES]) {
      expect("wasAmount" in p).toBe(false);
    }
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

describe("renewalAmount (ADR-0260 §5 40%-X9 ladder)", () => {
  test("matches the locked ladder points", () => {
    // The ADR's worked examples: $199→$79 · $149→$59 · $129→$49 · $99→$39 · $49→$19, plus the
    // six bundle prices ($1,449→$579 · $739→$289 · $629→$249 · $329→$129 · $399→$159 · $2,059→$819).
    expect(renewalAmount("ai-meter")).toBe(79); // $199
    expect(renewalAmount("guardrails")).toBe(59); // $149
    expect(renewalAmount("prompt-registry")).toBe(39); // $99
    expect(renewalAmount("compliance")).toBe(579); // $1,449
    expect(renewalAmount("everything")).toBe(819); // $2,059
  });

  test("every catalog entry yields a positive integer ending in 9, at most 40% of list", () => {
    for (const p of [...MODULE_PRICES, ...BUNDLE_PRICES]) {
      if (p.amount === null) continue;
      const r = renewalAmount(p.id);
      expect(r).not.toBeNull();
      expect(Number.isInteger(r)).toBe(true);
      expect((r ?? 0) % 10).toBe(9);
      expect(r ?? 0).toBeLessThanOrEqual(Math.floor((p.amount * 40) / 100));
      // Floor to the NEAREST X9: adding 10 must overshoot 40% of list.
      expect((r ?? 0) + 10).toBeGreaterThan(Math.floor((p.amount * 40) / 100));
    }
  });

  test("unknown ids stay number-free (null)", () => {
    expect(renewalAmount("not-a-real-sku")).toBeNull();
    expect(renewalAmount("")).toBeNull();
  });
});

describe("multiYearRenewalAmount (R6 rider — mechanism only, floors to the nearest X9 like renewalAmount)", () => {
  test("fail-closed on non-finite or out-of-range inputs — null, never NaN or an inflated price", () => {
    expect(multiYearRenewalAmount(Number.NaN, 2, 1_000)).toBeNull();
    expect(multiYearRenewalAmount(79, Number.NaN, 1_000)).toBeNull();
    expect(multiYearRenewalAmount(79, 2, Number.NaN)).toBeNull();
    expect(multiYearRenewalAmount(79, 2, -500)).toBeNull(); // negative-discount typo must not inflate
    expect(multiYearRenewalAmount(79, 2, 10_001)).toBeNull();
    expect(multiYearRenewalAmount(Number.POSITIVE_INFINITY, 2, 0)).toBeNull();
  });

  test("floors the discounted naive-total (base*years) to the nearest X9, matching renewalAmount's ladder convention", () => {
    // base=79 (ai-meter's 1-year renewal), 2 years, 10% off the naive total:
    // naive=158 -> *0.90=142.2 -> floor 142 -> nearest X9 at-or-below is 139.
    expect(multiYearRenewalAmount(79, 2, 1_000)).toBe(139);
    // base=419 (compliance), 3 years, 15% off: naive=1257 -> *0.85=1068.45 -> floor 1068 -> X9 1059.
    expect(multiYearRenewalAmount(419, 3, 1_500)).toBe(1059);
  });

  test("zero discountBps still floors the naive total to the nearest X9 (no discount != no rounding)", () => {
    // naive=158, 0% off -> floor 158 -> nearest X9 at-or-below is 149.
    expect(multiYearRenewalAmount(79, 2, 0)).toBe(149);
  });

  test("every result is a positive integer ending in 9, at most the discounted naive total", () => {
    for (const [base, years, bps] of [
      [79, 2, 1_000],
      [59, 2, 500],
      [39, 3, 2_000],
      [819, 2, 1_000],
    ] as const) {
      const r = multiYearRenewalAmount(base, years, bps);
      const naive = base * years;
      const discounted = Math.floor((naive * (10_000 - bps)) / 10_000);
      expect(r).not.toBeNull();
      expect(Number.isInteger(r)).toBe(true);
      expect((r ?? 0) % 10).toBe(9);
      expect(r ?? 0).toBeLessThanOrEqual(discounted);
      expect((r ?? 0) + 10).toBeGreaterThan(discounted);
    }
  });

  test("a too-small discounted total stays number-free (null), same posture as renewalAmount", () => {
    expect(multiYearRenewalAmount(5, 1, 0)).toBeNull(); // naive 5, floors below the $9 floor
    expect(multiYearRenewalAmount(79, 2, 10_000)).toBeNull(); // 100% off -> naive*0 = 0
  });
});

describe("PLAN_PRICES", () => {
  test("carries no null-amount rows except Enterprise and priority-support", () => {
    const nullRows = PLAN_PRICES.filter((p) => p.amount === null);
    expect(nullRows.map((p) => p.id).sort()).toEqual([
      "enterprise",
      "priority-support",
    ]);
  });

  test("carries no one-time bundle row (BUNDLE_PRICES owns the bundles)", () => {
    // The legacy $1,499 "Everything bundle" plan row retired with the W7 flip — a second bundle
    // anchor here would let two different Everything prices render at once.
    expect(PLAN_PRICES.find((p) => p.id === "bundle")).toBeUndefined();
  });

  // Track K (ADR-0278, price-agnostic plumbing): the priority-support SKU must stay fail-closed —
  // no price, no unit, so no existing generic renderer (formatPrice's yearly-range math, the cart)
  // can accidentally treat it as purchasable.
  test("priority-support carries no price, no unit, and is absent from every checkout surface", () => {
    const row = priceById("priority-support");
    expect(row).toBeDefined();
    expect(row?.amount).toBeNull();
    expect(row?.unit).toBeNull();
  });
});

describe("prioritySupportResponseTimeCopy (ADR-0278 response-time copy surface)", () => {
  test("the config source is unset (operator-owned; no placeholder number)", () => {
    expect(PRIORITY_SUPPORT_RESPONSE_TIME).toBeNull();
  });

  test("renders an honest unset line, never a fabricated commitment or the word SLA", () => {
    const copy = prioritySupportResponseTimeCopy();
    expect(copy.toLowerCase()).not.toContain("sla");
    expect(copy).toBe("Response-time commitment: unset.");
  });
});

describe("buildStackSummary (compose-a-stack math, ADR-0191)", () => {
  test("a full single-bundle member selection nudges to that bundle (below-sum arithmetic)", () => {
    // The six ai-production members sum to $994; the bundle is $739 — the nudge is the honest
    // arithmetic, saving $255.
    const ids = modulesByBundle("ai-production").map((m) => m.id);
    const s = buildStackSummary(ids);
    expect(s.total).toBe(994);
    expect(s.upgrade?.target).toBe("ai-production");
    expect(s.upgrade?.price).toBe(739);
    expect(s.upgrade?.saves).toBe(994 - 739);
  });

  test("the compliance member set nudges to the compliance bundle, never Everything", () => {
    // Ten compliance members sum to $2,070 vs the $1,449 bundle (saves $621); Everything at
    // $2,059 is dearer than the $1,449 persona bundle, so the persona bundle wins.
    const ids = modulesByBundle("compliance").map((m) => m.id);
    const s = buildStackSummary(ids);
    expect(s.total).toBe(2070);
    expect(s.upgrade?.target).toBe("compliance");
    expect(s.upgrade?.saves).toBe(2070 - 1449);
  });

  test("no offer when a la carte is already the cheapest path", () => {
    // Three ai-production members: 199 + 149 + 99 = 447 < the $739 bundle — cheaper a la carte.
    const s = buildStackSummary(["ai-meter", "guardrails", "prompt-registry"]);
    expect(s.total).toBe(447);
    expect(s.upgrade).toBeUndefined();
  });

  test("a cross-bundle selection below the Everything price gets no offer (coverage-honest)", () => {
    // audit-worm (compliance) + agent-kernel (agentic-dev): no persona bundle covers both, and
    // Everything costs more than the $348 selection — an offer would be a fabricated saving.
    const s = buildStackSummary(["audit-worm", "agent-kernel"]);
    expect(s.total).toBe(348);
    expect(s.upgrade).toBeUndefined();
  });

  test("a standalone SKU is covered only by Everything", () => {
    // org-controls belongs to no persona bundle; alone it is far below the Everything price.
    const s = buildStackSummary(["org-controls"]);
    expect(s.upgrade).toBeUndefined();
  });

  test("the whole catalog nudges to Everything (the explicit full-catalog rule)", () => {
    const s = buildStackSummary(MODULE_PRICES.map((m) => m.id));
    expect(s.total).toBe(moduleCatalogSubtotal());
    expect(s.upgrade?.target).toBe("everything");
    expect(s.upgrade?.price).toBe(2059);
    expect(s.upgrade?.saves).toBe(moduleCatalogSubtotal() - 2059);
  });

  test("an owned covering bundle suppresses the nudge (never stack a second covering bundle)", () => {
    // Everything covers any selection by construction; the ai-production bundle covers its own
    // members — in both cases nudging again would be pure overpay on top of the owned bundle.
    const ids = modulesByBundle("ai-production").map((m) => m.id);
    expect(buildStackSummary(ids, ["everything"]).upgrade).toBeUndefined();
    expect(buildStackSummary(ids, ["ai-production"]).upgrade).toBeUndefined();
  });

  test("an owned NON-covering bundle leaves the nudge intact", () => {
    const ids = modulesByBundle("ai-production").map((m) => m.id);
    const s = buildStackSummary(ids, ["local-first"]);
    expect(s.upgrade?.target).toBe("ai-production");
  });

  test("empty and unknown ids are ignored", () => {
    expect(buildStackSummary([]).total).toBe(0);
    expect(buildStackSummary([]).upgrade).toBeUndefined();
    expect(buildStackSummary(["not-a-real-module"]).moduleCount).toBe(0);
  });

  test("the running total is always an integer (money is never a float, ADR-0007)", () => {
    const ids = modulesByBundle("ai-production").map((m) => m.id);
    expect(Number.isInteger(buildStackSummary(ids).total)).toBe(true);
  });
});

describe("BUNDLE_PRICES (ADR-0257 vocabulary · ADR-0258 numbers)", () => {
  test("the six bundle ids match the shared pricebook vocabulary (no drift)", () => {
    const priceIds = BUNDLE_PRICES.map((b) => b.id as string).sort();
    expect(priceIds).toEqual(Object.keys(BUNDLE_RETAIL).sort());
    expect([...(BUNDLE_IDS as readonly string[])].sort()).toEqual(
      Object.keys(BUNDLE_RETAIL).sort(),
    );
  });

  test("every bundle display price equals the locked pricebook retail (never hand-invented here)", () => {
    for (const b of BUNDLE_PRICES) {
      expect(b.amount).toBe(BUNDLE_RETAIL[b.id as keyof typeof BUNDLE_RETAIL]);
      expect(Number.isInteger(b.amount)).toBe(true);
      expect(b.amount).toBeGreaterThan(0);
    }
  });

  test("every bundle is priced strictly below the sum of its priced members (the 0.75x below-sum lock)", () => {
    for (const b of BUNDLE_PRICES) {
      const memberSum = creditableMembers(
        b.id as Parameters<typeof creditableMembers>[0],
      ).reduce((sum, id) => sum + (SKU_RETAIL[id] ?? 0), 0);
      expect(memberSum).toBeGreaterThan(0);
      expect(b.amount ?? 0).toBeLessThan(memberSum);
    }
  });

  test("the price ladder holds: Everything costs at least every other bundle (never undercut)", () => {
    const everything = bundlePriceById("everything");
    expect(everything?.amount).not.toBeNull();
    for (const b of BUNDLE_PRICES) {
      expect(everything?.amount ?? 0).toBeGreaterThanOrEqual(b.amount ?? 0);
    }
  });

  test("bundlePriceById resolves every bundle id and nothing else", () => {
    for (const id of BUNDLE_IDS) {
      expect(bundlePriceById(id)?.id).toBe(id);
    }
  });
});

describe("bundle membership honesty (the registry index is the entitlement truth)", () => {
  // A bundle purchase expands to the registry index members map (expandEntitlements, ADR-0071/0257),
  // so every `bundles[]` entry a module carries must match that map — registry members maps are the
  // ONLY membership truth. This lint pins the site's hand-keyed `bundles[]` to them BIDIRECTIONALLY
  // (over-claim AND under-claim) for every persona/Provenance bundle. Compliance rides the
  // @caisson/compliance edition entry (which carries the bundle members map); the other four are
  // first-class kind:"bundle" entries.
  const REGISTRY_BUNDLE_IDS: Record<Exclude<BundleId, "everything">, string> = {
    compliance: "@caisson/compliance",
    "ai-production": "@caisson/ai-production",
    "local-first": "@caisson/local-first",
    "agentic-dev": "@caisson/agentic-dev",
    provenance: "@caisson/provenance",
  };

  interface IndexModule {
    id: string;
    latest: string;
    versions: readonly {
      version: string;
      manifest?: { members?: Record<string, unknown> };
    }[];
  }

  async function bundleMembers(): Promise<Record<string, ReadonlySet<string>>> {
    const index = (await Bun.file(
      new URL("../../../registry/index.json", import.meta.url),
    ).json()) as { modules: IndexModule[] };
    const out: Record<string, ReadonlySet<string>> = {};
    for (const regId of Object.values(REGISTRY_BUNDLE_IDS)) {
      const entry = index.modules.find((m) => m.id === regId);
      if (!entry) continue;
      const latest =
        entry.versions.find((v) => v.version === entry.latest) ??
        entry.versions[entry.versions.length - 1];
      out[regId] = new Set(Object.keys(latest?.manifest?.members ?? {}));
    }
    return out;
  }

  test("every module's bundles[] exactly matches the registry members maps (both directions)", async () => {
    const members = await bundleMembers();
    const violations: string[] = [];
    for (const m of MODULE_PRICES) {
      for (const bundle of PERSONA_BUNDLE_IDS) {
        const regId = REGISTRY_BUNDLE_IDS[bundle];
        const map = members[regId];
        if (!map) {
          violations.push(
            `${bundle}: bundle missing from registry index (${regId})`,
          );
          continue;
        }
        const listed = m.bundles.includes(bundle);
        const granted = map.has(`@caisson/${m.id}`);
        if (listed && !granted) {
          violations.push(
            `${m.id}: claims membership in ${bundle} but absent from ${regId}'s members map — fix bundles[] or repin the members`,
          );
        }
        if (!listed && granted) {
          violations.push(
            `${m.id}: granted by ${regId}'s members map but not listed in bundles[] (under-claim) — add ${bundle}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("no module lists the everything bundle (it contains every SKU by construction)", () => {
    for (const m of MODULE_PRICES) {
      expect(m.bundles).not.toContain("everything");
    }
  });

  test("modulesByBundle returns exactly the modules whose bundles[] include it", () => {
    for (const bundle of PERSONA_BUNDLE_IDS) {
      const byHelper = modulesByBundle(bundle)
        .map((m) => m.id)
        .sort();
      const byFilter = MODULE_PRICES.filter((m) => m.bundles.includes(bundle))
        .map((m) => m.id)
        .sort();
      expect(byHelper).toEqual(byFilter);
    }
  });
});
