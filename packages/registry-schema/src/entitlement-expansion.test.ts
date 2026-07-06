// ADR-0071 entitlement-expansion resolver — golden-first (ADR-0013). RED until the resolver lands:
// this file imports `expandEntitlements` / `BUNDLE_ID` from `./entitlements`, which does not exist
// yet, so the file fails to resolve its import and the suite is RED — proving the fixture + golden
// precede the logic. The follow-up `feat(registry): entitlement-expansion resolver` commit makes it
// green with `BLESS` unset.
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
  normalizeEntitlementId,
} from "./bundle-vocabulary";
import {
  BUNDLE_ID,
  RESERVED_MODULE_ENTITLEMENT_IDS,
  baseModuleIds,
  expandEntitlements,
  expandEntitlementsFromFile,
} from "./entitlements";
import { loadRegistryIndex, loadRegistryIndexFromFile } from "./registry-index";

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
  { purchased: ["ai-kit"] },
  { purchased: ["local-ai"] },
  { purchased: [BUNDLE_ID] },
  { purchased: ["@caisson/credits"] },
  { purchased: ["ai-kit", "local-ai"] },
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

  test("the bundle equals base + every edition's members (index-derived, never token-baked)", () => {
    const bundle = [...expandEntitlements(index, [BUNDLE_ID])].sort();
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

  test("RESERVED_MODULE_ENTITLEMENT_IDS is empty — alerting/retention-runner graduated to indexed", () => {
    // Both are now published in the registry index (ADR-0150/0151), so reserving them would
    // under-grant a buyer who purchased them; the carve-out set is cleared (catalog-rework W5).
    expect([...RESERVED_MODULE_ENTITLEMENT_IDS]).toEqual([]);
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

  test("base ⊆ the bundle (bundle = base ∪ all editions)", () => {
    const bundle = expandEntitlements(index, [BUNDLE_ID]);
    for (const id of baseModuleIds(index)) expect(bundle.has(id)).toBe(true);
  });

  test("a commercial base-kind module stays bundle-deliverable + à-la-carte (gated, not removed)", () => {
    // credits is commercial base: excluded from the FREE floor, but an entitled bundle OR bare-slug
    // buyer still receives it — the license gate is on the free-view floor only, never on expansion.
    expect(expandEntitlements(index, [BUNDLE_ID]).has("@caisson/credits")).toBe(
      true,
    );
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

describe("ADR-0257 bundle vocabulary + legacy-alias resolution", () => {
  test("the locked bundle-id set and alias map match ADR-0257 exactly", () => {
    expect([...BUNDLE_IDS]).toEqual([
      "compliance",
      "ai-production",
      "local-first",
      "agentic-dev",
      "provenance",
      "everything",
    ]);
    expect([...LEGACY_ENTITLEMENT_ALIASES.entries()]).toEqual([
      ["compliance", "compliance"],
      ["ai-kit", "ai-production"],
      ["local-ai", "local-first"],
      ["agent-dev", "agentic-dev"],
      ["bundle", "everything"],
    ]);
  });

  test("normalizeEntitlementId maps legacy ids and passes everything else through", () => {
    expect(normalizeEntitlementId("ai-kit")).toBe("ai-production");
    expect(normalizeEntitlementId("bundle")).toBe("everything");
    expect(normalizeEntitlementId("compliance")).toBe("compliance");
    expect(normalizeEntitlementId("credits")).toBe("credits");
    expect(normalizeEntitlementId("@caisson/kernel")).toBe("@caisson/kernel");
    // A Map, never a record lookup — a prototype-shaped key must pass through, not leak
    // Object.prototype members.
    expect(normalizeEntitlementId("constructor")).toBe("constructor");
    expect(normalizeEntitlementId("__proto__")).toBe("__proto__");
  });

  test("each legacy purchased id expands to the IDENTICAL leaf set its new bundle id does", () => {
    for (const [legacy, bundleId] of LEGACY_ENTITLEMENT_ALIASES) {
      expect([...expandEntitlements(index, [legacy])].sort()).toEqual(
        [...expandEntitlements(index, [bundleId])].sort(),
      );
    }
  });

  test("the everything bundle id equals the legacy bundle sentinel (derived full-catalog fallback)", () => {
    expect([...expandEntitlements(index, ["everything"])].sort()).toEqual(
      [...expandEntitlements(index, [BUNDLE_ID])].sort(),
    );
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

  test("TM-E pin: an unknown id still fails closed AFTER alias normalization", () => {
    // Normalization must never widen the accepted-id surface: unknown ids throw exactly as before.
    expect(() => expandEntitlements(index, ["not-a-bundle"])).toThrow();
    expect(() => expandEntitlements(index, ["ai-kit", "garbage"])).toThrow();
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
    // The legacy sentinel rides the same alias → same explicit rule.
    expect([...expandEntitlements(withEverything, [BUNDLE_ID])].sort()).toEqual(
      ["@caisson/credits"],
    );
  });
});

describe("ADR-0257 alias round-trip against the REAL registry index (pre-change capture)", () => {
  // Captured by running the PRE-0257 resolver against registry/index.json (2026-07-06, index
  // rebuild 0.2.0 line). Each legacy purchased id must keep expanding to this exact leaf set —
  // renaming without the alias 422s the server path and silently downgrades the Worker path.
  // W5's members-fold republish will consciously re-baseline these sets (membership grows).
  const REAL_INDEX = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "registry",
    "index.json",
  );
  const PRE_CHANGE_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
    compliance: [
      "@caisson/alerting",
      "@caisson/audit-worm",
      "@caisson/compliance",
      "@caisson/field-crypto",
      "@caisson/kernel",
      "@caisson/retention-runner",
      "@caisson/tenancy-rls",
    ],
    "ai-kit": [
      "@caisson/ai-config",
      "@caisson/ai-kit",
      "@caisson/ai-meter",
      "@caisson/credits",
      "@caisson/field-crypto",
      "@caisson/guardrails",
      "@caisson/kernel",
      "@caisson/prompt-registry",
      "@caisson/tenancy-rls",
    ],
    "local-ai": [
      "@caisson/field-crypto",
      "@caisson/kernel",
      "@caisson/license-verify",
      "@caisson/local-ai",
      "@caisson/local-store",
    ],
    "agent-dev": [
      "@caisson/agent-dev",
      "@caisson/agent-kernel",
      "@caisson/agent-runner",
      "@caisson/ai-config",
      "@caisson/kernel",
      "@caisson/local-store",
      "@caisson/tool-exec",
    ],
  };

  const realIndex = loadRegistryIndexFromFile(REAL_INDEX);

  test("each legacy id expands to the identical pre-change leaf set", () => {
    for (const [legacy, expected] of Object.entries(PRE_CHANGE_EXPANSIONS)) {
      expect([...expandEntitlements(realIndex, [legacy])].sort()).toEqual([
        ...expected,
      ]);
    }
  });

  test("each legacy id and its new bundle id expand identically on the real index", () => {
    for (const [legacy, bundleId] of LEGACY_ENTITLEMENT_ALIASES) {
      expect([...expandEntitlements(realIndex, [legacy])].sort()).toEqual(
        [...expandEntitlements(realIndex, [bundleId])].sort(),
      );
    }
  });

  test("the legacy bundle sentinel still expands to the full catalog on the real index", () => {
    const bundle = [...expandEntitlements(realIndex, [BUNDLE_ID])].sort();
    const everything = realIndex.modules.map((m) => m.id).sort();
    expect(bundle).toEqual(everything);
  });
});

describe("expandEntitlementsFromFile (ADR-0047 disk read path)", () => {
  test("composes loadRegistryIndexFromFile + expandEntitlements", () => {
    expect(
      [...expandEntitlementsFromFile(FIXTURE_INDEX, ["compliance"])].sort(),
    ).toEqual([...expandEntitlements(index, ["compliance"])].sort());
  });
});
