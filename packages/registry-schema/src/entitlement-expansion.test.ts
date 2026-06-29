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
  baseModuleIds,
  expandEntitlements,
  expandEntitlementsFromFile,
} from "./entitlements";
import { loadRegistryIndexFromFile } from "./registry-index";

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

describe("baseModuleIds (ADR-0094 — the free, always-served substrate)", () => {
  test("returns exactly the modules scoped to no edition (editions[] === [])", () => {
    const base = [...baseModuleIds(index)].sort();
    const expected = index.modules
      .filter((m) => {
        const v =
          m.versions.find((x) => x.version === m.latest) ??
          m.versions[m.versions.length - 1];
        return v !== undefined && v.manifest.editions.length === 0;
      })
      .map((m) => m.id)
      .sort();
    expect(base).toEqual(expected);
    expect(base.length).toBeGreaterThan(0); // the fixture has base members
  });

  test("base ⊆ the bundle (bundle = base ∪ all editions)", () => {
    const bundle = expandEntitlements(index, [BUNDLE_ID]);
    for (const id of baseModuleIds(index)) expect(bundle.has(id)).toBe(true);
  });
});

describe("expandEntitlementsFromFile (ADR-0047 disk read path)", () => {
  test("composes loadRegistryIndexFromFile + expandEntitlements", () => {
    expect(
      [...expandEntitlementsFromFile(FIXTURE_INDEX, ["compliance"])].sort(),
    ).toEqual([...expandEntitlements(index, ["compliance"])].sort());
  });
});
