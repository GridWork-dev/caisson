// Open-core gate checks (ADR-0094/0097). These lock the license SPLIT (open Base = Apache-2.0, else
// commercial) and the open↔commercial no-depend-up BOUNDARY. Synthetic Pkg[] inputs — no workspace IO.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkOpenCoreLicensing,
  checkOpenCommercialBoundary,
  checkManifestAgreement,
  checkManifestPriceAgreement,
  checkRlsEquivalence,
  checkShippedProse,
} from "./checks";
// Same relative import checks.ts itself uses (SPEC-tenancy-rls task 3: no workspace specifier —
// this build session cannot `bun install` a new dependency edge).
import { buildTenantPolicySql } from "../../../packages/tenancy-rls/src/rls.ts";
import type { Pkg } from "./workspace";

const APACHE = "Apache-2.0";
const COMMERCIAL = "LicenseRef-Caisson-Commercial";

/** Build a module-candidate Pkg (under packages/) with sane defaults; `over` wins on every field. */
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

describe("checkOpenCoreLicensing (ADR-0094/0097)", () => {
  test("an open-Base package on Apache-2.0 passes", () => {
    expect(
      checkOpenCoreLicensing([
        pkg({ name: "@caisson/kernel", license: APACHE }),
      ]),
    ).toEqual([]);
  });

  test("registry-schema (the open contract) must be Apache-2.0", () => {
    expect(
      checkOpenCoreLicensing([
        pkg({ name: "@caisson/registry-schema", license: APACHE }),
      ]),
    ).toEqual([]);
    const bad = checkOpenCoreLicensing([
      pkg({ name: "@caisson/registry-schema", license: COMMERCIAL }),
    ]);
    expect(bad).toHaveLength(1);
    expect(bad[0]?.rule).toBe("open-core-license");
  });

  test("an open-Base package on the commercial license is flagged", () => {
    // jobs, not credits — credits flipped commercial (ADR-0249 G5) and left OPEN_BASE_NAMES.
    const f = checkOpenCoreLicensing([
      pkg({ name: "@caisson/jobs", license: COMMERCIAL }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("open Base");
    expect(f[0]?.message).toContain(APACHE);
  });

  test("a non-Base package must be commercial — Apache-2.0 is flagged", () => {
    const f = checkOpenCoreLicensing([
      pkg({ name: "@caisson/field-crypto", license: APACHE }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("commercial");
  });

  test("a non-Base commercial package passes", () => {
    expect(
      checkOpenCoreLicensing([
        pkg({ name: "@caisson/compliance", license: COMMERCIAL }),
      ]),
    ).toEqual([]);
  });

  test("a non-packages/ candidate (apps/, registry service) is skipped", () => {
    const app: Pkg = {
      ...pkg({ name: "@caisson/base-app", license: COMMERCIAL }),
      dir: "/repo/apps/example",
    };
    const service: Pkg = {
      ...pkg({ name: "@caisson/registry", license: COMMERCIAL }),
      dir: "/repo/registry",
    };
    expect(checkOpenCoreLicensing([app, service])).toEqual([]);
  });

  test("a missing license is left to checkDeclarations (not double-flagged)", () => {
    expect(
      checkOpenCoreLicensing([pkg({ name: "@caisson/kernel", license: null })]),
    ).toEqual([]);
  });
});

describe("checkOpenCommercialBoundary (ADR-0094/0097)", () => {
  const commercialRegistry = pkg({
    name: "@caisson/registry",
    license: COMMERCIAL,
    dir: "/repo/registry",
  });

  test("open → open dependency passes", () => {
    const credits = pkg({
      name: "@caisson/credits",
      license: APACHE,
      workspaceDeps: ["@caisson/kernel", "@caisson/registry-schema"],
    });
    const kernel = pkg({ name: "@caisson/kernel", license: APACHE });
    const schema = pkg({ name: "@caisson/registry-schema", license: APACHE });
    expect(checkOpenCommercialBoundary([credits, kernel, schema])).toEqual([]);
  });

  test("open → commercial dependency is flagged (the W1 conflict)", () => {
    const credits = pkg({
      name: "@caisson/credits",
      license: APACHE,
      workspaceDeps: ["@caisson/registry"],
    });
    const f = checkOpenCommercialBoundary([credits, commercialRegistry]);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("open-core-boundary");
    expect(f[0]?.message).toContain("@caisson/registry");
  });

  test("open → unlicensed workspace dependency is flagged", () => {
    const open = pkg({
      name: "@caisson/ui",
      license: APACHE,
      workspaceDeps: ["@caisson/mystery"],
    });
    const mystery = pkg({ name: "@caisson/mystery", license: null });
    const f = checkOpenCommercialBoundary([open, mystery]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("unlicensed");
  });

  test("commercial → commercial and commercial → open both pass (only open is constrained)", () => {
    // Synthetic commercial consumer (the real cli is open Apache-2.0 Base as of ADR-0136); the
    // pricebook is a real commercial package that legitimately depends "down" onto open + commercial.
    const consumer = pkg({
      name: "@caisson/pricebook",
      license: COMMERCIAL,
      workspaceDeps: ["@caisson/registry", "@caisson/kernel"],
    });
    const kernel = pkg({ name: "@caisson/kernel", license: APACHE });
    expect(
      checkOpenCommercialBoundary([consumer, kernel, commercialRegistry]),
    ).toEqual([]);
  });

  test("open -> @caisson dep absent from the workspace is flagged (fail-closed)", () => {
    const open = pkg({
      name: "@caisson/billing",
      license: APACHE,
      workspaceDeps: ["@caisson/ghost"], // not present in the pkg set
    });
    const f = checkOpenCommercialBoundary([open]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("absent from the workspace");
  });
});

describe("checkManifestAgreement fail-closed (ADR-0094/0097)", () => {
  const fixtureDir = join(import.meta.dir, "__fixtures__");

  test("a schema-invalid manifest (defineModule throws on load) is an ERROR, not a warn", async () => {
    const f = await checkManifestAgreement([
      pkg({
        name: "@caisson/fixture-invalid",
        license: APACHE,
        version: "0.0.0",
        manifestPath: join(fixtureDir, "invalid-manifest.fixture.ts"),
      }),
    ]);
    const err = f.find(
      (x) => x.rule === "manifest-agreement" && x.severity === "error",
    );
    expect(err).toBeDefined();
    expect(err?.message).toContain("rejected it");
  });

  test("an unresolvable manifest path is a WARN (resolution failure, skipped)", async () => {
    const f = await checkManifestAgreement([
      pkg({
        name: "@caisson/fixture-missing",
        license: APACHE,
        version: "0.0.0",
        manifestPath: join(fixtureDir, "does-not-exist.fixture.ts"),
      }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("warn");
  });
});

describe("checkManifestPriceAgreement (audit-v2 P1 price-drift guard)", () => {
  const fixtureDir = join(import.meta.dir, "__fixtures__");

  test("a priceCents matching PRICE_AUTHORITY passes", async () => {
    const f = await checkManifestPriceAgreement([
      pkg({
        name: "@caisson/compliance",
        license: COMMERCIAL,
        manifestPath: join(fixtureDir, "price-agreement-match.fixture.ts"),
      }),
    ]);
    expect(f).toEqual([]);
  });

  test("a priceCents drifted from PRICE_AUTHORITY is an ERROR", async () => {
    const f = await checkManifestPriceAgreement([
      pkg({
        name: "@caisson/compliance",
        license: COMMERCIAL,
        manifestPath: join(fixtureDir, "price-agreement-drift.fixture.ts"),
      }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("manifest-price-agreement");
    expect(f[0]?.severity).toBe("error");
    expect(f[0]?.message).toContain("ADR-0383");
  });

  test("a package not seeded in PRICE_AUTHORITY is out of scope (skipped)", async () => {
    const f = await checkManifestPriceAgreement([
      pkg({
        name: "@caisson/some-other-priced-pkg",
        license: COMMERCIAL,
        // Never resolved — the check short-circuits before importing an unseeded package's manifest.
        manifestPath: join(fixtureDir, "does-not-exist.fixture.ts"),
      }),
    ]);
    expect(f).toEqual([]);
  });
});

describe("checkRlsEquivalence (ADR-0210/0005)", () => {
  // Real temp dir — checkRlsEquivalence reads `<pkg.dir>/src/migrations/*.sql` and
  // `<root>/tooling/standards-gate/rls-equivalence-overrides.json` off disk (same real-fs pattern
  // as checkExternalAgpl's fixtures above; never a checked-in fixture for a generated tree).
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "standards-gate-rls-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const TABLE_SQL =
    "CREATE TABLE widget (\n  id uuid PRIMARY KEY,\n  account_id text NOT NULL\n);\n";

  /** Writes one migration file for a fixture package and returns its Pkg. */
  function widgetPkg(rlsSql: string): Pkg {
    const dir = join(root, "packages", "fixture-widget");
    mkdirSync(join(dir, "src", "migrations"), { recursive: true });
    writeFileSync(
      join(dir, "src", "migrations", "0001_widget.sql"),
      TABLE_SQL + rlsSql,
    );
    return pkg({ name: "@caisson/fixture-widget", license: APACHE, dir });
  }

  function narrowGrantSql(): string {
    return buildTenantPolicySql("widget", {
      column: "account_id",
      role: "app",
    }).replace(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON widget TO app;",
      "GRANT SELECT, INSERT ON widget TO app;",
    );
  }

  test("a tenant table with no RLS block at all is rls-missing", async () => {
    const p = widgetPkg("");
    const f = await checkRlsEquivalence([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("rls-missing");
  });

  test("an RLS block matching buildTenantPolicySql's output exactly is clean", async () => {
    const p = widgetPkg(
      buildTenantPolicySql("widget", { column: "account_id", role: "app" }),
    );
    expect(await checkRlsEquivalence([p], root)).toEqual([]);
  });

  test("an unlisted narrower-than-generated GRANT is rls-equivalence", async () => {
    const p = widgetPkg(narrowGrantSql());
    const f = await checkRlsEquivalence([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("rls-equivalence");
  });

  test("a narrower GRANT listed in the overrides file is clean", async () => {
    const p = widgetPkg(narrowGrantSql());
    const overridesDir = join(root, "tooling", "standards-gate");
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, "rls-equivalence-overrides.json"),
      JSON.stringify([
        { table: "widget", package: p.name, reason: "test fixture" },
      ]),
    );
    expect(await checkRlsEquivalence([p], root)).toEqual([]);
  });

  // ADR-0006 append-only: a shipped migration's RLS predicate is never edited in place — a
  // hardening follow-up re-issues the policy (DROP + CREATE) in a NEW migration file instead. The
  // gate must evaluate the EFFECTIVE (latest) policy across all of a package's migration files, not
  // the table's original (now-superseded) one.
  test("a DROP+CREATE POLICY re-issued in a later migration file is checked against its effective form", async () => {
    const p = widgetPkg(narrowGrantSql()); // 0001: original policy, narrower GRANT
    writeFileSync(
      join(p.dir, "src", "migrations", "0002_widget_rls_harden.sql"),
      [
        "DROP POLICY widget_tenant_isolation ON widget;",
        buildTenantPolicySql("widget", { column: "account_id", role: "app" })
          // buildTenantPolicySql also emits ENABLE/FORCE/full-CRUD GRANT, which 0001 already has —
          // only the re-issued CREATE POLICY line is relevant to this fixture.
          .split("\n")
          .filter((l) => l.startsWith("CREATE POLICY") || l.startsWith("  ")),
        "",
      ]
        .flat()
        .join("\n"),
    );
    // 0002's re-issued policy matches buildTenantPolicySql's CURRENT output exactly — only the
    // narrower (but overrides-covered) GRANT from 0001 remains, which requires the override.
    const overridesDir = join(root, "tooling", "standards-gate");
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, "rls-equivalence-overrides.json"),
      JSON.stringify([
        { table: "widget", package: p.name, reason: "test fixture" },
      ]),
    );
    expect(await checkRlsEquivalence([p], root)).toEqual([]);
  });
});

describe("checkShippedProse (docs/shipped-source-quality-rubric.md)", () => {
  // Real temp-dir fixtures — the gate reads README/AGENTS/CHANGELOG/package.json/src off disk
  // (same real-fs pattern as checkRlsEquivalence's fixtures above).
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "standards-gate-prose-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A module-candidate Pkg rooted at `<root>/<relDir>`, with `src/` pre-created. */
  function fixturePkg(name: string, relDir: string): Pkg {
    const dir = join(root, relDir);
    mkdirSync(join(dir, "src"), { recursive: true });
    return pkg({ name, dir, license: APACHE });
  }

  test("a clean package — README, comment, and description all buyer-readable — passes", () => {
    const p = fixturePkg("@caisson/fixture-clean", "packages/fixture-clean");
    writeFileSync(
      join(p.dir, "README.md"),
      "# Fixture\n\nInstalls the fixture client and retries once on timeout.\n",
    );
    writeFileSync(
      join(p.dir, "package.json"),
      JSON.stringify({
        name: p.name,
        description: "A buyer-readable one-line capability statement.",
      }),
    );
    writeFileSync(
      join(p.dir, "src", "index.ts"),
      '// Retries the request once before giving up — the upstream API is flaky under load.\nexport const parseWave = () => 1;\nconst url = "https://example.com//two-slashes-not-a-comment";\n',
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("a gridwork-ism in a README is flagged (SS-1)", () => {
    const p = fixturePkg(
      "@caisson/fixture-gridwork",
      "packages/fixture-gridwork",
    );
    writeFileSync(
      join(p.dir, "README.md"),
      "Rebuilt clean from the public gridwork-core.\n",
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("shipped-prose");
    expect(f[0]?.message).toContain("SS-1");
    expect(f[0]?.message).toContain("gridwork");
  });

  test("a Linear ticket id in a CHANGELOG is flagged (SS-4)", () => {
    const p = fixturePkg(
      "@caisson/fixture-caisson",
      "packages/fixture-caisson",
    );
    writeFileSync(
      join(p.dir, "CHANGELOG.md"),
      "### Patch\n\nFixed the ledger race condition (CAISSON-17).\n",
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("CAISSON-17");
  });

  test("a Wave-N label in AGENTS.md is flagged (SS-2)", () => {
    const p = fixturePkg("@caisson/fixture-wave", "packages/fixture-wave");
    writeFileSync(join(p.dir, "AGENTS.md"), "Composes the Wave-0 substrate.\n");
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("Wave-0");
  });

  test("a bare `// see ADR-NNNN` comment is flagged (SS-3)", () => {
    const p = fixturePkg(
      "@caisson/fixture-bare-adr",
      "packages/fixture-bare-adr",
    );
    writeFileSync(
      join(p.dir, "src", "index.ts"),
      "// see ADR-0182\nexport const x = 1;\n",
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("SS-3");
  });

  test("a NAKED id-only comment is flagged too — line and block forms (SS-3, review P1)", () => {
    const p = fixturePkg(
      "@caisson/fixture-naked-adr",
      "packages/fixture-naked-adr",
    );
    writeFileSync(
      join(p.dir, "src", "index.ts"),
      "// ADR-0182\nexport const x = 1;\n/* ADR-0182 */\nexport const y = 2;\n// ADR-0182, ADR-0183.\nexport const z = 3;\n",
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(3);
    expect(f.every((x) => x.message.includes("SS-3"))).toBe(true);
  });

  test("a trailing non-parenthetical ADR citation in package.json description is flagged (SS-12)", () => {
    const p = fixturePkg("@caisson/fixture-desc", "packages/fixture-desc");
    writeFileSync(
      join(p.dir, "package.json"),
      JSON.stringify({
        name: p.name,
        description:
          "Provider-agnostic AI config resolver for buyer-supplied keys. ADR-0070/0090",
      }),
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("SS-12");
  });

  test("an ADR id cited parenthetically after ≥4 plain-English words in a comment passes (SS-3 allowlist)", () => {
    const p = fixturePkg(
      "@caisson/fixture-parenthetical",
      "packages/fixture-parenthetical",
    );
    writeFileSync(
      join(p.dir, "src", "index.ts"),
      "// BYOK inference is billed at zero credits (ADR-0182).\nexport const x = 1;\n",
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("the same parenthetical allowance holds for a package.json description", () => {
    const p = fixturePkg(
      "@caisson/fixture-desc-parenthetical",
      "packages/fixture-desc-parenthetical",
    );
    writeFileSync(
      join(p.dir, "package.json"),
      JSON.stringify({
        name: p.name,
        description:
          "Handles the credits ledger and the integer money path (ADR-0060).",
      }),
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("tooling/audit-harness is exempt even with a leak", () => {
    const p = fixturePkg("@caisson/audit-harness", "tooling/audit-harness");
    writeFileSync(
      join(p.dir, "README.md"),
      "gridwork-core CAISSON-99 Wave-0\n",
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("apps/admin is exempt even with a leak", () => {
    const p = fixturePkg("@caisson/admin", "apps/admin");
    writeFileSync(
      join(p.dir, "README.md"),
      "gridwork-core internal ops console.\n",
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("apps/site is in scope", () => {
    const p = fixturePkg("@caisson/site", "apps/site");
    writeFileSync(
      join(p.dir, "README.md"),
      "The gridwork-core marketing shell.\n",
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
  });
});
