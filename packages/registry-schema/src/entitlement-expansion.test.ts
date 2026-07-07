// ADR-0071 entitlement-expansion resolver — golden-first (ADR-0013). Originally RED-until-resolver;
// the golden fixture + expectations precede the logic. ADR-0270 (edition-trace purge) re-baselined the
// golden onto the canonical six-bundle vocabulary: the dissolved edition ids (`ai-kit`/`local-ai`/
// `agent-dev`) and the `bundle` sentinel are no longer purchasable/normalizable ids, so every case buys
// a canonical bundle id (they resolve to the SAME member sets via the decoupled EDITION_BUNDLE_ID index
// relation on this edition-tagged fixture).
//
// The fixed input index lives at `__golden__/entitlement-expansion.index.json` (a synthetic, valid
// RegistryIndex with editions tagged across base + the four editions, incl. one module shared by two
// editions to exercise dedup). It is loaded through `loadRegistryIndexFromFile` — the ADR-0071 read
// path (resolve against the built index, never raw manifests per call). The expected member slugs
// for each purchase scenario are pinned in `__golden__/entitlement-expansion.json`.
import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchGolden } from "@caisson/testing";
import {
  BUNDLE_IDS,
  LEGACY_ENTITLEMENT_ALIASES,
  entitlementIdAliasGroup,
  normalizeEntitlementId,
} from "./bundle-vocabulary";
import {
  RESERVED_MODULE_ENTITLEMENT_IDS,
  baseModuleIds,
  expandEntitlements,
  expandEntitlementsFromFile,
} from "./entitlements";
import { loadRegistryIndex, loadRegistryIndexFromFile } from "./registry-index";

/** The canonical whole-catalog bundle id (ADR-0257) — the `everything` bundle. On an index WITHOUT an
 *  explicit `@caisson/everything` bundle entry (this suite's fixture) it derives base ∪ every edition's
 *  members, the behavior the legacy `bundle` sentinel had before ADR-0270 purged that sentinel. */
const EVERYTHING = "everything" as const;

const FIXTURE_INDEX = join(
  dirname(fileURLToPath(import.meta.url)),
  "__golden__",
  "entitlement-expansion.index.json",
);
const index = loadRegistryIndexFromFile(FIXTURE_INDEX);

/** Each purchase scenario: a single edition, the bundle sentinel, an à-la-carte module, and the
 *  multi-purchase / dedup combinations. The produced member set is sorted for a stable golden. */
const CASES: ReadonlyArray<{ readonly purchased: readonly string[] }> = [
  { purchased: ["compliance"] },
  { purchased: ["ai-production"] },
  { purchased: ["local-first"] },
  { purchased: [EVERYTHING] },
  { purchased: ["@caisson/credits"] },
  { purchased: ["ai-production", "local-first"] },
  { purchased: ["compliance", "@caisson/kernel"] },
  // Bare package-slug per-module purchase-id form (no `@caisson/` prefix) — resolves
  // the same indexed module the full-id form above does.
  { purchased: ["credits"] },
  { purchased: ["kernel"] },
  { purchased: ["evidence-pack"] },
  { purchased: ["credits", "evidence-pack"] },
];

describe("ADR-0071 entitlement expansion (golden-first, ADR-0013)", () => {
  test("each purchase expands to exactly its index-derived member slugs (golden)", () => {
    const produced = CASES.map((c) => ({
      purchased: c.purchased,
      members: [...expandEntitlements(index, c.purchased)].sort(),
    }));
    matchGolden(import.meta.url, "entitlement-expansion", produced);
  });

  test("the everything bundle equals base + every edition's members (index-derived, never token-baked)", () => {
    const bundle = [...expandEntitlements(index, [EVERYTHING])].sort();
    // base (editions[] === []) ∪ each edition's members == every module in the index.
    const everything = index.modules.map((m) => m.id).sort();
    expect(bundle).toEqual(everything);
  });

  test("an unknown purchased id fails closed (throws — never a silent grant or silent drop)", () => {
    expect(() => expandEntitlements(index, ["not-an-edition"])).toThrow();
  });

  test("a module-shaped id absent from the index fails closed", () => {
    expect(() =>
      expandEntitlements(index, ["@caisson/not-in-index"]),
    ).toThrow();
  });

  test("one bad id rejects the whole expansion (fail-closed, no partial grant)", () => {
    expect(() =>
      expandEntitlements(index, ["compliance", "garbage"]),
    ).toThrow();
  });

  test("no purchases yield no entitlements (empty allowlist, fail-closed)", () => {
    expect([...expandEntitlements(index, [])]).toEqual([]);
  });
});

describe("per-module bare-slug purchase-id form", () => {
  test("a bare slug resolves to the same member the full @caisson/<slug> id would", () => {
    expect([...expandEntitlements(index, ["credits"])]).toEqual([
      ...expandEntitlements(index, ["@caisson/credits"]),
    ]);
  });

  test("a bare slug for a module scoped to an edition still resolves to just that module", () => {
    expect([...expandEntitlements(index, ["evidence-pack"])]).toEqual([
      "@caisson/evidence-pack",
    ]);
  });

  test("a bare slug absent from the index and not reserved fails closed", () => {
    expect(() => expandEntitlements(index, ["not-a-real-module"])).toThrow();
  });

  test("RESERVED_MODULE_ENTITLEMENT_IDS is empty — ui-pro graduated at its first publish", () => {
    // ui-pro published 2026-07-07 (@caisson/ui-pro@0.1.0 indexed; everything@0.2.2 repins it off
    // the 0.0.0 sentinel) and left the reservation in the SAME change — the documented graduation
    // path alerting/retention-runner took (ADR-0150/0151). The mechanism stays for the next
    // sold-before-published SKU.
    expect([...RESERVED_MODULE_ENTITLEMENT_IDS]).toEqual([]);
  });

  test("with the reservation gone, an unindexed ui-pro fails closed like any unknown id", () => {
    // This FIXTURE index carries no @caisson/ui-pro entry, and post-graduation no fail-soft
    // carve-out remains — the TM-E fail-closed throw applies to any index that doesn't ship it.
    // The REAL index resolves it (real-index suite below).
    expect(() => expandEntitlements(index, ["ui-pro"])).toThrow(
      /unknown purchased entitlement id/,
    );
  });

  test("a graduated slug now resolves to its real indexed grant, not fail-soft to nothing", () => {
    // The graduation this change makes: a slug once reserved (fail-soft to nothing) now resolves to
    // its real @caisson/<slug> grant once its package is indexed — proven here against the REAL
    // registry index where alerting/retention-runner ship.
    const real = loadRegistryIndexFromFile(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "..",
        "registry",
        "index.json",
      ),
    );
    expect([...expandEntitlements(real, ["alerting"])]).toEqual([
      "@caisson/alerting",
    ]);
    expect([...expandEntitlements(real, ["retention-runner"])]).toEqual([
      "@caisson/retention-runner",
    ]);
    // The headline graduation of this change: a bare ui-pro purchase resolves to the real module
    // grant against the REAL index that now ships it.
    expect([...expandEntitlements(real, ["ui-pro"])]).toEqual([
      "@caisson/ui-pro",
    ]);
  });

  test("a bare slug for an indexed module resolves normally (the graduated path)", () => {
    // An index that carries `@caisson/alerting` resolves the bare slug to it exactly like any other
    // indexed module — the ordinary indexed-module branch every graduated (formerly-reserved) SKU
    // now takes.
    const published = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        ...index.modules,
        {
          id: "@caisson/alerting",
          latest: "0.1.0",
          versions: [
            {
              version: "0.1.0",
              manifest: {
                id: "@caisson/alerting",
                version: "0.1.0",
                kind: "primitive",
                editions: [],
                tier: "paid",
                priceCents: 4900,
                license: "LicenseRef-Caisson-Commercial",
                dependencies: [],
                members: {},
                entry: "src/index.ts",
                agents: "AGENTS.md",
                golden: null,
                stability: "alpha",
                description: "simulated future module",
              },
              publishedAt: "2026-06-30T00:00:00.000Z",
              gateAttestation: "ci-fixture@0000001",
            },
          ],
        },
      ],
    });
    expect([...expandEntitlements(published, ["alerting"])]).toEqual([
      "@caisson/alerting",
    ]);
  });
});

describe("baseModuleIds (ADR-0094/0097 — the free, always-served OPEN substrate)", () => {
  test("returns only the OPEN (Apache-2.0) modules scoped to no edition — commercial base is gated", () => {
    const base = [...baseModuleIds(index)].sort();
    const expected = index.modules
      .filter((m) => {
        const v =
          m.versions.find((x) => x.version === m.latest) ??
          m.versions[m.versions.length - 1];
        return (
          v !== undefined &&
          v.manifest.editions.length === 0 &&
          v.manifest.license === "Apache-2.0"
        );
      })
      .map((m) => m.id)
      .sort();
    expect(base).toEqual(expected);
    expect(base).toEqual(["@caisson/kernel"]); // kernel is the fixture's open Apache-2.0 base
    // @caisson/credits is base-scoped (editions[]===[]) but COMMERCIAL → NOT free-view (now gated).
    expect(base).not.toContain("@caisson/credits");
  });

  test("base ⊆ the everything bundle (everything = base ∪ all editions)", () => {
    const bundle = expandEntitlements(index, [EVERYTHING]);
    for (const id of baseModuleIds(index)) expect(bundle.has(id)).toBe(true);
  });

  test("a commercial base-kind module stays bundle-deliverable + à-la-carte (gated, not removed)", () => {
    // credits is commercial base: excluded from the FREE floor, but an entitled bundle OR bare-slug
    // buyer still receives it — the license gate is on the free-view floor only, never on expansion.
    expect(
      expandEntitlements(index, [EVERYTHING]).has("@caisson/credits"),
    ).toBe(true);
    expect([...expandEntitlements(index, ["credits"])]).toEqual([
      "@caisson/credits",
    ]);
  });
});

describe("edition expansion reads the ADR-0077 members map (commercial members with editions[]===[])", () => {
  // The real catalog's commercial edition MEMBERS (field-crypto, audit-worm, ai-meter, …) carry
  // editions[]===[] in their own manifest — they do NOT self-declare edition membership — but they ARE
  // listed in the edition meta-package's frozen `members` map (ADR-0077). Once the free-view floor is
  // Apache-only, an edition sentinel (["compliance"]) must still deliver them, so the expansion derives
  // membership from that map. This hermetic index reproduces the real shape (the shared fixture above
  // happens to have members that self-declare, so it can't exercise this gap).
  const idx = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      {
        id: "@caisson/open-base",
        latest: "0.1.0",
        versions: [
          {
            version: "0.1.0",
            publishedAt: "2026-06-30T00:00:00.000Z",
            gateAttestation: "ci-fixture@0000002",
            manifest: {
              id: "@caisson/open-base",
              version: "0.1.0",
              kind: "base",
              editions: [],
              tier: "oss",
              license: "Apache-2.0",
              description: "open Apache-2.0 base (fixture).",
            },
          },
        ],
      },
      {
        id: "@caisson/paid-member",
        latest: "0.1.0",
        versions: [
          {
            version: "0.1.0",
            publishedAt: "2026-06-30T00:00:00.000Z",
            gateAttestation: "ci-fixture@0000002",
            manifest: {
              id: "@caisson/paid-member",
              version: "0.1.0",
              kind: "primitive",
              editions: [], // commercial member that does NOT self-declare edition membership
              tier: "paid",
              priceCents: 4900,
              license: "LicenseRef-Caisson-Commercial",
              description:
                "commercial member reachable only via the members map (fixture).",
            },
          },
        ],
      },
      {
        id: "@caisson/demo-edition",
        latest: "0.1.0",
        versions: [
          {
            version: "0.1.0",
            publishedAt: "2026-06-30T00:00:00.000Z",
            gateAttestation: "ci-fixture@0000002",
            manifest: {
              id: "@caisson/demo-edition",
              version: "0.1.0",
              kind: "edition",
              editions: ["compliance"],
              tier: "paid",
              priceCents: 4900,
              license: "LicenseRef-Caisson-Commercial",
              members: {
                "@caisson/demo-edition": "0.1.0",
                "@caisson/paid-member": "0.1.0",
                "@caisson/open-base": "0.1.0",
              },
              description:
                "edition meta naming compliance; its members map carries the paid member.",
            },
          },
        ],
      },
    ],
  });

  test("an edition sentinel expands to its members-map members, incl. a commercial member with editions[]===[]", () => {
    const members = [...expandEntitlements(idx, ["compliance"])].sort();
    expect(members).toEqual([
      "@caisson/demo-edition",
      "@caisson/open-base",
      "@caisson/paid-member",
    ]);
  });

  test("the sentinel does not over-grant beyond the members map (fail-closed, index-derived)", () => {
    // Only the three ids in the map/self-declarers — nothing else, and never a non-indexed id.
    expect(expandEntitlements(idx, ["compliance"]).size).toBe(3);
  });

  test("a members-map member is still gated for the anonymous free floor (Apache-only)", () => {
    // paid-member is commercial + editions[]===[] → NOT in the free view; it reaches a buyer only
    // through the edition (or its own bare slug), never the anonymous base floor.
    expect([...baseModuleIds(idx)]).toEqual(["@caisson/open-base"]);
  });
});

describe("ADR-0257/0270 bundle vocabulary + purchase-alias spine", () => {
  test("the locked bundle-id set is the six bundles and the alias spine is EMPTY (ADR-0270 purge)", () => {
    expect([...BUNDLE_IDS]).toEqual([
      "compliance",
      "ai-production",
      "local-first",
      "agentic-dev",
      "provenance",
      "everything",
    ]);
    // ADR-0270: the four edition ids + the `bundle` sentinel were removed — zero real buyers held them.
    // The spine is narrowed to nothing-but-the-mechanism (a future module rename plugs one entry in here).
    expect([...LEGACY_ENTITLEMENT_ALIASES.entries()]).toEqual([]);
  });

  test("normalizeEntitlementId is identity over the emptied spine (edition ids no longer map)", () => {
    // Post-purge every id passes through unchanged — the dissolved edition ids are NOT aliases anymore.
    expect(normalizeEntitlementId("ai-kit")).toBe("ai-kit");
    expect(normalizeEntitlementId("bundle")).toBe("bundle");
    expect(normalizeEntitlementId("compliance")).toBe("compliance");
    expect(normalizeEntitlementId("credits")).toBe("credits");
    expect(normalizeEntitlementId("@caisson/kernel")).toBe("@caisson/kernel");
    // A Map, never a record lookup — a prototype-shaped key must pass through, not leak
    // Object.prototype members.
    expect(normalizeEntitlementId("constructor")).toBe("constructor");
    expect(normalizeEntitlementId("__proto__")).toBe("__proto__");
  });

  test("entitlementIdAliasGroup is a singleton group over the emptied spine", () => {
    // No surviving alias → every id is its own group. (A future rename makes a group non-trivial again;
    // the mechanism test below proves that path against an injected fake rename.)
    expect(entitlementIdAliasGroup("ai-production")).toEqual(["ai-production"]);
    expect(entitlementIdAliasGroup("everything")).toEqual(["everything"]);
    expect(entitlementIdAliasGroup("compliance")).toEqual(["compliance"]);
    expect(entitlementIdAliasGroup("field-crypto")).toEqual(["field-crypto"]);
    expect(entitlementIdAliasGroup("__proto__")).toEqual(["__proto__"]);
  });

  test("the alias mechanism SURVIVES for the next module rename (ADR-0270 §9.3, fake-entry injection)", () => {
    // The load-bearing guarantee, tested independently of the now-empty edition data: a hypothetical
    // future module rename `old-widget → new-widget` must resolve through the SINGLE point + fold on the
    // read-side group. Inject it directly into the shared map (a real Map behind the ReadonlyMap type),
    // assert, then restore — proving the purge kept the mechanism, not just the (emptied) data.
    const map = LEGACY_ENTITLEMENT_ALIASES as Map<string, string>;
    map.set("old-widget", "new-widget");
    try {
      expect(normalizeEntitlementId("old-widget")).toBe("new-widget");
      expect(normalizeEntitlementId("unrenamed-slug")).toBe("unrenamed-slug");
      expect([...entitlementIdAliasGroup("new-widget")].sort()).toEqual([
        "new-widget",
        "old-widget",
      ]);
      // A caller holding the OLD spelling normalizes to the new one at the single point.
      expect([...entitlementIdAliasGroup("old-widget")].sort()).toEqual([
        "new-widget",
        "old-widget",
      ]);
    } finally {
      map.delete("old-widget");
    }
    expect(LEGACY_ENTITLEMENT_ALIASES.size).toBe(0); // restored to the narrowed production spine
  });

  test("a dissolved edition id resolves ONLY to its still-indexed meta package (no over-grant)", () => {
    // ADR-0270 §9.4 (honest form): `@caisson/ai-kit` stays a served `kind:"edition"` artifact (the ledger
    // is append-only, the index republish is deferred), so a bare `ai-kit` purchased id resolves through
    // the ordinary indexed-module branch to JUST that meta package — never the whole former edition. That
    // is an UNDER-grant (fail-safe), and the drain (§4) proves no grant row carries it, so it is moot in
    // production. It is emphatically NOT the everything/ai-production expansion.
    expect([...expandEntitlements(index, ["ai-kit"])]).toEqual([
      "@caisson/ai-kit",
    ]);
    const aiProduction = expandEntitlements(index, ["ai-production"]);
    expect(aiProduction.size).toBeGreaterThan(1);
    // The dissolved id grants a strict subset of its former bundle — no widening anywhere.
    for (const id of expandEntitlements(index, ["ai-kit"])) {
      expect(aiProduction.has(id)).toBe(true);
    }
  });

  test("everything derives base ∪ every edition on an index without an explicit bundle entry", () => {
    // The fixture carries no `@caisson/everything` bundle entry, so `everything` takes the derived
    // full-catalog fallback (base ∪ every edition's members) — the behavior the retired `bundle` sentinel
    // had, now reached only via the canonical id.
    const everything = [...expandEntitlements(index, [EVERYTHING])].sort();
    expect(everything).toEqual(index.modules.map((m) => m.id).sort());
  });

  test("a KNOWN bundle id with no index presence expands to nothing (fail-soft, edition semantics)", () => {
    // provenance is in the vocabulary but has no index entry until W5 — same fail-soft-to-empty an
    // index-absent edition always had: never an over-grant, never a whole-expansion throw that
    // would lock out a buyer's other purchased ids.
    expect([...expandEntitlements(index, ["provenance"])]).toEqual([]);
    expect(
      [...expandEntitlements(index, ["provenance", "credits"])].sort(),
    ).toEqual(["@caisson/credits"]);
  });

  test("TM-E pin: an unknown id still fails closed, and one bad id rejects the whole set", () => {
    // The emptied spine must never widen the accepted-id surface: a genuinely unknown id throws, and a
    // valid id alongside it does not rescue the expansion (one bad id rejects the whole set).
    expect(() => expandEntitlements(index, ["not-a-bundle"])).toThrow();
    expect(() =>
      expandEntitlements(index, ["ai-production", "garbage"]),
    ).toThrow();
    expect(() =>
      expandEntitlements(index, ["everything-else-entirely"]),
    ).toThrow();
  });

  test('a kind:"bundle" index entry expands via its members map exactly like an edition (ADR-0257)', () => {
    // Hermetic: the shared fixture plus a first-class provenance bundle entry whose members map
    // carries an existing indexed module + a phantom pin (allowlist-guarded → never granted).
    const withBundle = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        ...index.modules,
        {
          id: "@caisson/provenance",
          latest: "0.1.0",
          versions: [
            {
              version: "0.1.0",
              publishedAt: "2026-07-06T00:00:00.000Z",
              gateAttestation: "ci-fixture@0000003",
              manifest: {
                id: "@caisson/provenance",
                version: "0.1.0",
                kind: "bundle",
                editions: [],
                tier: "paid",
                priceCents: 39900,
                license: "LicenseRef-Caisson-Commercial",
                members: {
                  "@caisson/provenance": "0.1.0",
                  "@caisson/credits": "0.1.0",
                  "@caisson/not-indexed": "0.1.0", // phantom pin — allowlist-guarded, never granted
                },
                description: "Provenance bundle fixture (ADR-0257).",
              },
            },
          ],
        },
      ],
    });
    expect([...expandEntitlements(withBundle, ["provenance"])].sort()).toEqual([
      "@caisson/credits",
      "@caisson/provenance",
    ]);
  });

  test('everything PREFERS its explicit kind:"bundle" entry over the derived full-catalog rule', () => {
    const withEverything = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        ...index.modules,
        {
          id: "@caisson/everything",
          latest: "0.1.0",
          versions: [
            {
              version: "0.1.0",
              publishedAt: "2026-07-06T00:00:00.000Z",
              gateAttestation: "ci-fixture@0000003",
              manifest: {
                id: "@caisson/everything",
                version: "0.1.0",
                kind: "bundle",
                editions: [],
                tier: "paid",
                priceCents: 205900,
                license: "LicenseRef-Caisson-Commercial",
                members: { "@caisson/credits": "0.1.0" },
                description:
                  "Explicit Everything membership rule fixture (W5 replaces the derived scan).",
              },
            },
          ],
        },
      ],
    });
    // The explicit entry's members map wins — NOT base ∪ all editions.
    expect(
      [...expandEntitlements(withEverything, ["everything"])].sort(),
    ).toEqual(["@caisson/credits"]);
  });
});

describe("ADR-0257/0270 bundle expansion against the REAL registry index (post-fold capture)", () => {
  // Captured against registry/index.json AFTER the W5 members-fold republish (2026-07-06), then
  // re-captured after the ADR-0271 delist (2026-07-07): the three dissolved edition meta packages
  // (@caisson/ai-kit, @caisson/local-ai, @caisson/agent-dev) left the served index, so they are
  // ABSENT from every leaf set. That is the ONLY delta — the delist-equality proof showed each
  // bundle's own members map carries every real member. Keyed on the CANONICAL bundle ids the
  // catalog + grants use.
  const REAL_INDEX = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "registry",
    "index.json",
  );
  const BUNDLE_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
    compliance: [
      "@caisson/alerting",
      "@caisson/audit-worm",
      "@caisson/compliance",
      "@caisson/compliance-core",
      "@caisson/field-crypto",
      "@caisson/frameworks-pack",
      "@caisson/kernel",
      "@caisson/retention-runner",
      "@caisson/signing-primitive",
      "@caisson/tenancy-rls",
    ],
    "ai-production": [
      "@caisson/ai-config",
      "@caisson/ai-evals",
      "@caisson/ai-meter",
      "@caisson/ai-production",
      "@caisson/credits",
      "@caisson/field-crypto",
      "@caisson/guardrails",
      "@caisson/kernel",
      "@caisson/prompt-registry",
      "@caisson/tenancy-rls",
    ],
    "local-first": [
      "@caisson/field-crypto",
      "@caisson/kernel",
      "@caisson/license-verify",
      "@caisson/local-first",
      "@caisson/local-inference",
      "@caisson/local-privacy",
      "@caisson/local-store",
      "@caisson/local-sync",
    ],
    "agentic-dev": [
      "@caisson/agent-kernel",
      "@caisson/agent-runner",
      "@caisson/agentic-dev",
      "@caisson/ai-config",
      "@caisson/kernel",
      "@caisson/local-store",
      "@caisson/tool-exec",
    ],
  };

  const realIndex = loadRegistryIndexFromFile(REAL_INDEX);

  test("each canonical bundle id expands to the identical post-delist leaf set", () => {
    for (const [bundleId, expected] of Object.entries(BUNDLE_EXPANSIONS)) {
      expect([...expandEntitlements(realIndex, [bundleId])].sort()).toEqual([
        ...expected,
      ]);
    }
  });

  test("a dissolved edition id REJECTS fail-closed on the real index (delisted, no resolution left)", () => {
    // ADR-0270 purged the alias; ADR-0271 delisted the meta itself. With no index entry to resolve,
    // the bare edition id is now an unknown purchased id — expandEntitlements throws (fail-closed),
    // and every consumer's catch degrades it to the free base floor. The bundle sets no longer
    // contain the metas either (the leaf-set pins above are the positive half of this invariant).
    for (const [edition, bundleId] of [
      ["ai-kit", "ai-production"],
      ["local-ai", "local-first"],
      ["agent-dev", "agentic-dev"],
    ] as const) {
      expect(() => expandEntitlements(realIndex, [edition])).toThrow(
        /unknown purchased entitlement id/,
      );
      const bundle = expandEntitlements(realIndex, [bundleId]);
      expect(bundle.has(`@caisson/${edition}`)).toBe(false);
      expect(bundle.size).toBeGreaterThan(1);
    }
  });

  test("the everything bundle id reads the explicit everything rule on the real index", () => {
    // Post-fold semantics: the indexed @caisson/everything bundle entry's explicit members map wins
    // over the derived full-catalog scan. The grant is that map filtered to indexed ids — since the
    // ui-pro first publish (everything@0.2.2) that includes @caisson/ui-pro at its real version —
    // and the open Apache base is deliberately absent (it ships free via the Worker's free-view
    // floor, never as a grant).
    const bundle = [...expandEntitlements(realIndex, [EVERYTHING])].sort();
    const everythingEntry = realIndex.modules.find(
      (m) => m.id === "@caisson/everything",
    );
    const latestManifest = everythingEntry?.versions.find(
      (v) => v.version === everythingEntry.latest,
    )?.manifest;
    const indexed = new Set(realIndex.modules.map((m) => m.id));
    const expected = Object.keys(latestManifest?.members ?? {})
      .filter((id) => indexed.has(id))
      .sort();
    expect(expected.length).toBeGreaterThan(20);
    expect(bundle).toEqual(expected);
    expect(bundle).not.toContain("@caisson/kernel");
    expect(bundle).toContain("@caisson/ui-pro");
  });
});

describe("expandEntitlementsFromFile (ADR-0047 disk read path)", () => {
  test("composes loadRegistryIndexFromFile + expandEntitlements", () => {
    expect(
      [...expandEntitlementsFromFile(FIXTURE_INDEX, ["compliance"])].sort(),
    ).toEqual([...expandEntitlements(index, ["compliance"])].sort());
  });
});
