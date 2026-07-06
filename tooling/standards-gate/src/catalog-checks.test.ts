// Catalog-rework gate checks (ADR-0248 F5, ADR-0257/0258). Real-tree assertions in the
// publish-config.test.ts house style — each check runs against the committed workspace and must be
// clean — plus targeted failure-path cases (synthetic Pkg[] and temp-dir fixtures, the
// checks.test.ts pattern) that prove each rule actually fires.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkCatalogParity,
  checkOrphanSku,
  checkPriceCoverage,
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
    externalDeps: [],
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

  test("catalog-parity: the site catalog agrees with the registry members maps + locked prices", async () => {
    // Returns [] only if pricing.ts + index.json loaded AND agreed — a warn (skip) would fail this,
    // so it also proves the cross-surface load path works against the real tree.
    expect(await checkCatalogParity(ROOT)).toEqual([]);
  });

  test("reserved-ids-staleness: flags exactly the two now-indexed reservations, as advisory warns", () => {
    const f = checkReservedIdsStaleness(ROOT);
    expect(f.map((x) => x.pkg).sort()).toEqual([
      "@caisson/alerting",
      "@caisson/retention-runner",
    ]);
    expect(f.every((x) => x.severity === "warn")).toBe(true);
    expect(f.every((x) => x.rule === "reserved-ids-staleness")).toBe(true);
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

  test("the placeholder anchor (4900) is not-yet-locked — no row required", async () => {
    const p = manifestPkg(
      "@caisson/fixture-placeholder",
      `{ kind: "primitive", priceCents: 4900 }`,
    );
    expect(await checkPriceCoverage([p])).toEqual([]);
  });

  test("an edition/bundle meta is formula-priced — no per-SKU row required", async () => {
    const edition = manifestPkg(
      "@caisson/fixture-edition",
      `{ kind: "edition", priceCents: 79900 }`,
    );
    const bundle = manifestPkg(
      "@caisson/fixture-bundle",
      `{ kind: "bundle", priceCents: 205900 }`,
    );
    expect(await checkPriceCoverage([edition, bundle])).toEqual([]);
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

// ─── catalog-parity failure paths (temp root with a fixture pricing.ts + index.json) ──────────────
describe("checkCatalogParity", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gate-parity-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function writeCatalog(
    modulesLiteral: string,
    indexMembers: Record<string, string>,
  ): void {
    const pricingDir = join(root, "apps", "site", "lib");
    mkdirSync(pricingDir, { recursive: true });
    writeFileSync(
      join(pricingDir, "pricing.ts"),
      `export const MODULE_PRICES = ${modulesLiteral};\n`,
    );
    mkdirSync(join(root, "registry"), { recursive: true });
    writeFileSync(
      join(root, "registry", "index.json"),
      JSON.stringify({
        modules: [
          {
            id: "@caisson/compliance",
            latest: "1.0.0",
            versions: [
              { version: "1.0.0", manifest: { members: indexMembers } },
            ],
          },
        ],
      }),
    );
  }

  test("absent cross-surface files → a warn (skip), never a false error", async () => {
    const f = await checkCatalogParity(root);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("warn");
  });

  test("a module the site claims an edition grants but the members map omits is a membership error", async () => {
    writeCatalog(
      `[{ id: "audit-worm", amount: 149, edition: "compliance" }, { id: "ghost", amount: 50, edition: "compliance" }]`,
      { "@caisson/audit-worm": "1.0.0" },
    );
    const f = await checkCatalogParity(root);
    const membership = f.filter((x) => x.message.includes("members map"));
    expect(membership.map((x) => x.pkg)).toEqual(["@caisson/ghost"]);
  });

  test("a displayed price that disagrees with a locked PRICE_AUTHORITY row is a price error", async () => {
    // audit-worm is locked at 14900; display it at $999 (99900¢) → mismatch.
    writeCatalog(`[{ id: "audit-worm", amount: 999, edition: "compliance" }]`, {
      "@caisson/audit-worm": "1.0.0",
    });
    const f = await checkCatalogParity(root);
    const price = f.filter((x) => x.message.includes("locks it at"));
    expect(price).toHaveLength(1);
    expect(price[0]?.pkg).toBe("@caisson/audit-worm");
  });

  test("an agreeing catalog is clean", async () => {
    writeCatalog(`[{ id: "audit-worm", amount: 149, edition: "compliance" }]`, {
      "@caisson/audit-worm": "1.0.0",
    });
    expect(await checkCatalogParity(root)).toEqual([]);
  });

  test("a standaloneOnly module is exempt from the membership check", async () => {
    writeCatalog(
      `[{ id: "ai-evals", amount: 199, edition: "ai-kit", standaloneOnly: true }]`,
      {},
    );
    // ai-kit isn't even in this fixture index; standaloneOnly means no membership claim to verify.
    expect(await checkCatalogParity(root)).toEqual([]);
  });
});

// ─── reserved-ids-staleness failure path (temp root with a fixture entitlements.ts + index.json) ──
describe("checkReservedIdsStaleness", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gate-reserved-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function writeReserved(setLiteral: string, indexedIds: string[]): void {
    const dir = join(root, "packages", "registry-schema", "src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "entitlements.ts"),
      `export const RESERVED_MODULE_ENTITLEMENT_IDS: ReadonlySet<string> = new Set(${setLiteral});\n`,
    );
    mkdirSync(join(root, "registry"), { recursive: true });
    writeFileSync(
      join(root, "registry", "index.json"),
      JSON.stringify({ modules: indexedIds.map((id) => ({ id })) }),
    );
  }

  test("a reserved id whose package is now indexed is a stale warn", () => {
    writeReserved(`["ghost-pkg", "alerting"]`, ["@caisson/alerting"]);
    const f = checkReservedIdsStaleness(root);
    expect(f.map((x) => x.pkg)).toEqual(["@caisson/alerting"]);
    expect(f[0]?.severity).toBe("warn");
  });

  test("a reserved id whose package is NOT yet indexed is not flagged (still legitimately reserved)", () => {
    writeReserved(`["ghost-pkg"]`, ["@caisson/alerting"]);
    expect(checkReservedIdsStaleness(root)).toEqual([]);
  });

  test("an empty reserved set produces nothing", () => {
    writeReserved(`[]`, ["@caisson/alerting"]);
    expect(checkReservedIdsStaleness(root)).toEqual([]);
  });
});
