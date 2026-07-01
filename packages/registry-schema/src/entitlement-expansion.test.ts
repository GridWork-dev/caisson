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
  // Bare package-slug per-module purchase-id form (P6-store track, no `@caisson/` prefix) — resolves
  // the same indexed module the full-id form above does.
  { purchased: ["credits"] },
  { purchased: ["kernel"] },
  { purchased: ["evidence-pack"] },
  { purchased: ["credits", "evidence-pack"] },
  // A reserved future-module bare slug (sold, not yet published) expands to nothing — no throw.
  { purchased: ["alerting"] },
  { purchased: ["retention-runner"] },
  // Mixing an indexed bare-slug module with a reserved one still resolves (only the indexed member).
  { purchased: ["credits", "alerting"] },
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

describe("per-module bare-slug purchase-id form (P6-store track)", () => {
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

  test("RESERVED_MODULE_ENTITLEMENT_IDS names the P6-store-locked future Compliance modules", () => {
    expect([...RESERVED_MODULE_ENTITLEMENT_IDS].sort()).toEqual([
      "alerting",
      "retention-runner",
    ]);
  });

  test("a reserved future-module slug expands to nothing (fail-soft, never a throw)", () => {
    for (const reserved of RESERVED_MODULE_ENTITLEMENT_IDS) {
      expect([...expandEntitlements(index, [reserved])]).toEqual([]);
    }
  });

  test("a reserved id never collides with a real indexed module (sold ≠ silently substituted)", () => {
    for (const reserved of RESERVED_MODULE_ENTITLEMENT_IDS) {
      expect(index.modules.map((m) => m.id)).not.toContain(
        `@caisson/${reserved}`,
      );
    }
  });

  test("a reserved id alongside a real purchase still resolves the real member (no whole-expansion throw)", () => {
    expect(
      [...expandEntitlements(index, ["credits", "alerting"])].sort(),
    ).toEqual(["@caisson/credits"]);
  });

  test("once a reserved module is published its bare slug resolves normally (simulated)", () => {
    // Prove the carve-out is temporary: an index that DOES carry `@caisson/alerting` resolves the
    // bare slug to it exactly like any other indexed module — the reserved-set membership is a
    // pre-publish gap-filler, not a permanent block.
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

describe("expandEntitlementsFromFile (ADR-0047 disk read path)", () => {
  test("composes loadRegistryIndexFromFile + expandEntitlements", () => {
    expect(
      [...expandEntitlementsFromFile(FIXTURE_INDEX, ["compliance"])].sort(),
    ).toEqual([...expandEntitlements(index, ["compliance"])].sort());
  });
});
