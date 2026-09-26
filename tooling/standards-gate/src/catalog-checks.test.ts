// Catalog-rework gate checks (ADR-0248 F5, ADR-0257/0258). Real-tree assertions in the
// publish-config.test.ts house style — each check runs against the committed workspace and must be
// clean — plus targeted failure-path cases (synthetic Pkg[] and temp-dir fixtures, the
// checks.test.ts pattern) that prove each rule actually fires.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkOrphanSku,
  checkPriceCoverage,
  checkPricebookPriceAgreement,
  checkNamedEntitlementTargets,
  checkReservedIdsStaleness,
  PRICE_AUTHORITY,
} from "./checks";
import { findRoot, readWorkspace, type Pkg } from "./workspace";

const ROOT = findRoot(import.meta.dir);
const pkgs = readWorkspace(ROOT);
const COMMERCIAL = "LicenseRef-Caisson-Commercial";
const APACHE = "Apache-2.0";

/** A module-candidate Pkg (dir under packages/) with sane defaults; `over` wins on every field. */
function pkg(over: Partial<Pkg> & Pick<Pkg, "name" | "license">): Pkg {
  return {
    dir: `/repo/packages/${over.name.replace("@caisson/", "")}`,
    version: "0.0.0",
    workspaceDeps: [],
    manifestPath: null,
    hasCode: true,
    ...over,
  };
}

// ─── Real-tree: the committed workspace must be clean (green) on all three error checks ───────────
describe("catalog gate checks — the committed tree", () => {
  test("price-coverage: every sellable commercial SKU with a locked price has a PRICE_AUTHORITY row", async () => {
    expect(await checkPriceCoverage(pkgs)).toEqual([]);
  });

  test("orphan-sku: every PRICE_AUTHORITY row maps to a real manifested package", () => {
    expect(checkOrphanSku(pkgs)).toEqual([]);
  });

  test("reserved-ids-staleness: no stale reservations (alerting/retention-runner graduated to indexed)", () => {
    // The check flagged alerting + retention-runner while they were still reserved; catalog-rework W5
    // cleared them from RESERVED_MODULE_ENTITLEMENT_IDS, so a clean tree now has nothing to flag.
    expect(checkReservedIdsStaleness(ROOT)).toEqual([]);
  });

  test("pricebook-price-agreement: every PRICE_AUTHORITY row agrees with the pricebook — and the import path resolves (a moved/broken upgrades.ts turns this red via the warn finding)", async () => {
    expect(await checkPricebookPriceAgreement(pkgs)).toEqual([]);
  });

  test("the eight catalog-rework carves carry a PRICE_AUTHORITY row", () => {
    for (const id of [
      "@caisson/org-controls",
      "@caisson/compliance-core",
      "@caisson/frameworks-pack",
      "@caisson/signing-primitive",
      "@caisson/billing-orchestration",
      "@caisson/local-sync",
      "@caisson/local-inference",
      "@caisson/local-privacy",
    ]) {
      expect(PRICE_AUTHORITY[id]).toBeDefined();
    }
  });
});

// ─── price-coverage failure paths (temp-dir manifest fixtures — the check reads mod.default) ──────
describe("checkPriceCoverage", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gate-price-coverage-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** Write a raw manifest object to a unique file and return a commercial module Pkg pointing at it. */
  function manifestPkg(name: string, body: string): Pkg {
    const file = join(dir, `${name.replace("@caisson/", "")}.manifest.ts`);
    writeFileSync(file, `export default ${body};\n`);
    return pkg({ name, license: COMMERCIAL, manifestPath: file });
  }

  test("a sellable commercial module at a LOCKED price with no PRICE_AUTHORITY row is an error", async () => {
    const p = manifestPkg(
      "@caisson/fixture-uncovered",
      `{ kind: "primitive", priceCents: 12345 }`,
    );
    const f = await checkPriceCoverage([p]);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("price-coverage");
    expect(f[0]?.severity).toBe("error");
    expect(f[0]?.message).toContain("no PRICE_AUTHORITY row");
  });

  test("sellable: false exempts a locked-price module (bundle-only substrate)", async () => {
    const p = manifestPkg(
      "@caisson/fixture-glue",
      `{ kind: "base", priceCents: 12345, sellable: false }`,
    );
    expect(await checkPriceCoverage([p])).toEqual([]);
  });

  test("a sellable $49 module still requires a PRICE_AUTHORITY row", async () => {
    const p = manifestPkg(
      "@caisson/fixture-placeholder",
      `{ kind: "primitive", priceCents: 4900 }`,
    );
    const f = await checkPriceCoverage([p]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("no PRICE_AUTHORITY row");
  });

  test("sellable edition and bundle metas require PRICE_AUTHORITY rows", async () => {
    const edition = manifestPkg(
      "@caisson/fixture-edition",
      `{ kind: "edition", priceCents: 79900 }`,
    );
    const bundle = manifestPkg(
      "@caisson/fixture-bundle",
      `{ kind: "bundle", priceCents: 225900 }`,
    );
    const findings = await checkPriceCoverage([edition, bundle]);
    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.rule === "price-coverage")).toBe(
      true,
    );
  });

  test("a sellable commercial module carrying no positive integer price is an error", async () => {
    const p = manifestPkg(
      "@caisson/fixture-priceless",
      `{ kind: "primitive", priceCents: null }`,
    );
    const f = await checkPriceCoverage([p]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("no positive integer priceCents");
  });

  test("a covered module (in PRICE_AUTHORITY) passes", async () => {
    const p = manifestPkg(
      "@caisson/audit-worm",
      `{ kind: "primitive", priceCents: 14900 }`,
    );
    expect(await checkPriceCoverage([p])).toEqual([]);
  });

  test("an open (Apache-2.0) package is out of scope", async () => {
    const p = pkg({
      name: "@caisson/kernel",
      license: APACHE,
      manifestPath: join(dir, "never-read.ts"),
    });
    expect(await checkPriceCoverage([p])).toEqual([]);
  });

  test("an unresolvable manifest is skipped, not errored (pre-install posture)", async () => {
    const p = pkg({
      name: "@caisson/fixture-missing",
      license: COMMERCIAL,
      manifestPath: join(dir, "does-not-exist.ts"),
    });
    expect(await checkPriceCoverage([p])).toEqual([]);
  });
});

// ─── pricebook-price-agreement failure paths (temp-dir pricebook fixture) ─────────────────────────
describe("checkPricebookPriceAgreement", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gate-pricebook-agreement-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /**
   * A fixture pricebook Pkg whose src/upgrades.ts mirrors the real PRICE_AUTHORITY in SKU_RETAIL
   * (BUNDLE_RETAIL empty — with no manifests in the fixture pkg set, nothing is exempted and every
   * row routes through SKU_RETAIL). `over` drifts a slug's dollars; `null` drops the row entirely.
   */
  function fixturePricebook(
    over: Record<string, number | null> = {},
    extra: Record<string, number> = {},
  ): Pkg {
    const rows = Object.entries(PRICE_AUTHORITY)
      .map(([id, { cents }]) => {
        const slug = id.replace("@caisson/", "");
        const dollars = slug in over ? over[slug] : cents / 100;
        return dollars == null ? null : `  "${slug}": ${dollars},`;
      })
      .filter((r) => r !== null)
      .concat(
        Object.entries(extra).map(
          ([slug, dollars]) => `  "${slug}": ${dollars},`,
        ),
      )
      .join("\n");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "upgrades.ts"),
      `export const SKU_RETAIL: Record<string, number> = {\n${rows}\n};\nexport const BUNDLE_RETAIL: Record<string, number> = {};\n`,
    );
    return pkg({ name: "@caisson/pricebook", license: COMMERCIAL, dir });
  }

  test("a fixture book mirroring PRICE_AUTHORITY exactly is green", async () => {
    expect(await checkPricebookPriceAgreement([fixturePricebook()])).toEqual(
      [],
    );
  });

  test("a drifted dollars value is an error (known-drift smoke: the check actually fires)", async () => {
    const f = await checkPricebookPriceAgreement([
      fixturePricebook({ "audit-worm": 999 }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("error");
    expect(f[0]?.rule).toBe("pricebook-price-agreement");
    expect(f[0]?.pkg).toBe("@caisson/audit-worm");
    expect(f[0]?.message).toContain("disagrees");
  });

  test("a missing row is an error (silent $0 upgrade credit)", async () => {
    const f = await checkPricebookPriceAgreement([
      fixturePricebook({ "audit-worm": null }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("no SKU_RETAIL/BUNDLE_RETAIL row");
  });

  test("an unimportable pricebook degrades to a VISIBLE warn, never a silent pass", async () => {
    const f = await checkPricebookPriceAgreement([
      pkg({
        name: "@caisson/pricebook",
        license: COMMERCIAL,
        dir: join(dir, "does-not-exist"),
      }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("warn");
    expect(f[0]?.message).toContain("could not be imported");
  });

  test("a pricebook row PRICE_AUTHORITY does not lock is an orphan error (the reverse direction)", async () => {
    // SKU_RETAIL keys are the creditable-item vocabulary upgrade quotes read, so an unlocked row is
    // a live money number no ADR pins — the mirror of checkOrphanSku on the pricebook side.
    const f = await checkPricebookPriceAgreement([
      fixturePricebook({}, { "ghost-sku": 499 }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("error");
    expect(f[0]?.rule).toBe("pricebook-price-agreement");
    expect(f[0]?.pkg).toBe("@caisson/ghost-sku");
    expect(f[0]?.message).toContain("no PRICE_AUTHORITY row locks");
  });

  test("no pricebook in the pkg set is out of scope", async () => {
    expect(await checkPricebookPriceAgreement([])).toEqual([]);
  });
});

// ─── orphan-sku failure path ──────────────────────────────────────────────────────────────────
describe("checkOrphanSku", () => {
  test("a PRICE_AUTHORITY id absent from the on-disk workspace is an orphan error", () => {
    // Drop @caisson/credits from the package set → its authority row now names nothing on disk.
    const without = pkgs.filter((p) => p.name !== "@caisson/credits");
    const f = checkOrphanSku(without);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("orphan-sku");
    expect(f[0]?.pkg).toBe("@caisson/credits");
  });

  test("a PRICE_AUTHORITY id that exists but carries no manifest is flagged", () => {
    const stripped = pkgs.map((p) =>
      p.name === "@caisson/credits" ? { ...p, manifestPath: null } : p,
    );
    const f = checkOrphanSku(stripped);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("not a manifested");
  });
});

// ─── reserved-ids-staleness failure path (temp root with a fixture entitlements.ts + index.json) ──
describe("checkReservedIdsStaleness", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gate-reserved-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function writeReserved(
    setLiteral: string,
    indexedIds: string[],
    versionEntries?: readonly (readonly [string, string])[],
  ): void {
    const dir = join(root, "packages", "registry-schema", "src");
    mkdirSync(dir, { recursive: true });
    // The `<string>` generic mirrors the REAL declaration in registry-schema — the parser regex
    // once required bare `new Set(` and silently no-opped on it (audit P2-2), so the fixture must
    // exercise the generic form or the test greens a broken parser.
    const slugs = [...setLiteral.matchAll(/["']([a-z0-9-]+)["']/g)].map(
      (match) => match[1] as string,
    );
    const versions =
      versionEntries ?? slugs.map((slug) => [slug, "0.1.0"] as const);
    writeFileSync(
      join(dir, "entitlements.ts"),
      [
        `export const RESERVED_MODULE_ENTITLEMENT_IDS: ReadonlySet<string> = new Set<string>(${setLiteral});`,
        `export const RESERVED_MODULE_ENTITLEMENT_VERSIONS: ReadonlyMap<string, string> = new Map<string, string>(${JSON.stringify(versions)});`,
        "",
      ].join("\n"),
    );
    mkdirSync(join(root, "registry"), { recursive: true });
    writeFileSync(
      join(root, "registry", "index.json"),
      JSON.stringify({ modules: indexedIds.map((id) => ({ id })) }),
    );
  }

  test("a reserved id whose package is now indexed fails the release gate", () => {
    writeReserved(`["ghost-pkg", "alerting"]`, ["@caisson/alerting"]);
    const f = checkReservedIdsStaleness(root);
    expect(f.map((x) => x.pkg)).toEqual(["@caisson/alerting"]);
    expect(f[0]?.severity).toBe("error");
  });

  test("a reserved id whose package is NOT yet indexed is not flagged (still legitimately reserved)", () => {
    writeReserved(`["ghost-pkg"]`, ["@caisson/alerting"]);
    expect(checkReservedIdsStaleness(root)).toEqual([]);
  });

  test("an empty reserved set produces nothing", () => {
    writeReserved(`[]`, ["@caisson/alerting"]);
    expect(checkReservedIdsStaleness(root)).toEqual([]);
  });

  test("the reserved id and first-version maps must have identical keys", () => {
    writeReserved(`["ghost-pkg"]`, [], [["different-pkg", "0.1.0"]]);
    const f = checkReservedIdsStaleness(root);
    expect(f.map((x) => x.pkg).sort()).toEqual([
      "@caisson/different-pkg",
      "@caisson/ghost-pkg",
    ]);
    expect(f.every((finding) => finding.severity === "error")).toBe(true);
  });
});

describe("checkNamedEntitlementTargets", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gate-named-ent-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Mirrors the REAL declarations in registry-schema, generics and all — a parser that only
   *  handles a simplified shape greens a gate that measures nothing (the release-audit B4 class). */
  function writeEdges(
    compat: string,
    runtime: string,
    indexedIds: string[],
    reserved = "[]",
  ): void {
    const dir = join(root, "packages", "registry-schema", "src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "entitlements.ts"),
      [
        `export const RESERVED_MODULE_ENTITLEMENT_IDS: ReadonlySet<string> = new Set<string>(${reserved});`,
        `export const COMPATIBILITY_REEXPORT_ENTITLEMENTS: ReadonlyMap<\n  string,\n  readonly string[]\n> = new Map<string, readonly string[]>(${compat});`,
        `export const INTERNAL_RUNTIME_ENTITLEMENTS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>(${runtime});`,
        "",
      ].join("\n"),
    );
    mkdirSync(join(root, "registry"), { recursive: true });
    writeFileSync(
      join(root, "registry", "index.json"),
      JSON.stringify({ modules: indexedIds.map((id) => ({ id })) }),
    );
  }

  test("an edge naming an unindexed, unreserved target is an ERROR", () => {
    writeEdges(
      `[["@caisson/compliance-core", ["@caisson/oscal-spine"]]]`,
      `[]`,
      ["@caisson/compliance-core"],
    );
    const f = checkNamedEntitlementTargets(root);
    expect(f.map((x) => x.pkg)).toEqual(["@caisson/oscal-spine"]);
    expect(f[0]?.severity).toBe("error");
  });

  test("an indexed target passes", () => {
    writeEdges(
      `[["@caisson/compliance-core", ["@caisson/oscal-spine"]]]`,
      `[]`,
      ["@caisson/compliance-core", "@caisson/oscal-spine"],
    );
    expect(checkNamedEntitlementTargets(root)).toEqual([]);
  });

  test("a target still under a pre-publish reservation passes", () => {
    writeEdges(
      `[["@caisson/compliance-core", ["@caisson/oscal-spine"]]]`,
      `[]`,
      ["@caisson/compliance-core"],
      `["oscal-spine"]`,
    );
    expect(checkNamedEntitlementTargets(root)).toEqual([]);
  });

  test("the INTERNAL_RUNTIME map is checked too, not just the compat map", () => {
    writeEdges(
      `[]`,
      `[["@caisson/oscal-spine", ["@caisson/artifact-render"]]]`,
      ["@caisson/oscal-spine"],
    );
    expect(checkNamedEntitlementTargets(root).map((x) => x.pkg)).toEqual([
      "@caisson/artifact-render",
    ]);
  });

  test("a reshaped declaration the regex cannot read is an ERROR, not a silent pass", () => {
    // The gate is a regex over source text. Hoisting the entries to a named const is a perfectly
    // ordinary refactor that makes it stop matching — and the runtime half skips unresolvable edges
    // silently by design, so without this the two halves go quiet at the same moment.
    writeEdges(`[]`, `[]`, []);
    const entPath = join(root, "packages/registry-schema/src/entitlements.ts");
    writeFileSync(
      entPath,
      readFileSync(entPath, "utf8").replace(
        /export const COMPATIBILITY_REEXPORT_ENTITLEMENTS[^;]*;/,
        "const COMPAT_ENTRIES = [];\nexport const COMPATIBILITY_REEXPORT_ENTITLEMENTS = new Map(COMPAT_ENTRIES);",
      ),
    );
    expect(checkNamedEntitlementTargets(root).map((x) => x.rule)).toContain(
      "named-entitlement-target-gate-blind",
    );
  });
});

// Known-positive against the REAL repository, not a fixture. Every test above writes the very
// declaration it then parses, so a reshaping of the ACTUAL `entitlements.ts` — the failure this
// gate's regex is most exposed to — is invisible to all of them. This one fails the day the parser
// stops seeing the real file.
describe("checkNamedEntitlementTargets against the real tree", () => {
  test("the parser still resolves the live entitlements.ts, and the gate is not blind", () => {
    const rules = new Set(
      checkNamedEntitlementTargets(ROOT).map((f) => f.rule),
    );
    expect(rules.has("named-entitlement-target-gate-blind")).toBe(false);
    expect(rules.has("named-entitlement-target-gate-unreadable")).toBe(false);
  });
});

// Known-positive against the REAL repository, not a fixture. Every test above writes the
// declaration it then parses, so a reshaping of the actual `entitlements.ts` — the failure mode this
// gates
