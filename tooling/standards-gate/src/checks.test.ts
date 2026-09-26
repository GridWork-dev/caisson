// Gate checks over synthetic Pkg[] inputs plus throwaway temp-dir fixtures — no workspace IO.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkManifestAgreement,
  checkNoSalesCopy,
  checkOpenLicense,
  checkPrivatePackages,
  checkRlsEquivalence,
  checkShippedProse,
} from "./checks";
// Same relative import checks.ts itself uses (SPEC-tenancy-rls task 3: no workspace specifier —
// this build session cannot `bun install` a new dependency edge).
import { buildTenantPolicySql } from "../../../packages/tenancy-rls/src/rls.ts";
import { findRoot, readWorkspace, type Pkg } from "./workspace";

const APACHE = "Apache-2.0";

/** Build a module-candidate Pkg (under packages/) with sane defaults; `over` wins on every field. */
function pkg(over: Partial<Pkg> & Pick<Pkg, "name" | "license">): Pkg {
  return {
    dir: `/repo/packages/${over.name.replace("@caisson-sh/", "")}`,
    version: "0.0.0",
    workspaceDeps: [],
    manifestPath: null,
    hasCode: true,
    private: false,
    ...over,
  };
}

describe("checkManifestAgreement fail-closed", () => {
  const fixtureDir = join(import.meta.dir, "__fixtures__");

  test("a schema-invalid manifest (defineModule throws on load) is an ERROR, not a warn", async () => {
    const f = await checkManifestAgreement([
      pkg({
        name: "@caisson-sh/fixture-invalid",
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
        name: "@caisson-sh/fixture-missing",
        license: APACHE,
        version: "0.0.0",
        manifestPath: join(fixtureDir, "does-not-exist.fixture.ts"),
      }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("warn");
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
    return pkg({ name: "@caisson-sh/fixture-widget", license: APACHE, dir });
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

describe("checkOpenLicense", () => {
  const APACHE_TEXT =
    "Apache License\nVersion 2.0\n...\nCopyright 2026 Caisson Software LLC\n";
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "standards-gate-license-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A package dir under the temp root, optionally with a LICENSE body. */
  function licensed(name: string, license: string, text?: string): Pkg {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    if (text !== undefined) writeFileSync(join(dir, "LICENSE"), text);
    return pkg({ name: `@caisson-sh/${name}`, dir, license });
  }

  test("Apache-2.0 plus an Apache LICENSE naming the holder is clean", () => {
    expect(checkOpenLicense([licensed("ok", APACHE, APACHE_TEXT)])).toEqual([]);
  });

  test("a non-Apache license is an error naming the package", () => {
    const f = checkOpenLicense([licensed("mit", "MIT", APACHE_TEXT)]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      severity: "error",
      rule: "open-license",
      pkg: "@caisson-sh/mit",
    });
    expect(f[0]?.message).toContain("MIT");
  });

  test("a missing LICENSE, or one that is not Apache naming the holder, is an error", () => {
    const f = checkOpenLicense([
      licensed("none", APACHE),
      licensed("other-holder", APACHE, "Apache License\nCopyright Someone\n"),
      licensed(
        "commercial",
        APACHE,
        "Commercial License\nCopyright (c) Caisson Software LLC.\n",
      ),
    ]);
    expect(f.map((x) => x.pkg)).toEqual([
      "@caisson-sh/none",
      "@caisson-sh/other-holder",
      "@caisson-sh/commercial",
    ]);
  });

  test("a private package is out of scope", () => {
    const p = { ...licensed("internal", "UNLICENSED"), private: true };
    expect(checkOpenLicense([p])).toEqual([]);
  });

  test("the committed tree is clean, and the check really walked the published set", () => {
    const pkgs = readWorkspace(findRoot(import.meta.dir));
    const published = pkgs.filter((p) => !p.private);
    expect(published.length).toBeGreaterThan(40);
    expect(checkOpenLicense(pkgs)).toEqual([]);
  });
});

describe("checkPrivatePackages", () => {
  const priv = (name: string, isPrivate = true): Pkg =>
    pkg({ name: `@caisson-sh/${name}`, license: APACHE, private: isPrivate });

  test("brand as the only private packages/ member is clean", () => {
    expect(
      checkPrivatePackages([priv("brand"), priv("kernel", false)]),
    ).toEqual([]);
  });

  test("a second private package, or brand going public, is an error", () => {
    const extra = checkPrivatePackages([priv("brand"), priv("billing")]);
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatchObject({
      severity: "error",
      rule: "open-license-private-set",
    });
    expect(extra[0]?.message).toContain("billing");
    expect(checkPrivatePackages([priv("brand", false)])).toHaveLength(1);
  });

  test("private members outside packages/ are not counted", () => {
    const app = { ...priv("site"), dir: "/repo/apps/site" };
    expect(checkPrivatePackages([priv("brand"), app])).toEqual([]);
  });

  test("the committed tree's private packages/ set is exactly brand", () => {
    expect(
      checkPrivatePackages(readWorkspace(findRoot(import.meta.dir))),
    ).toEqual([]);
  });
});

describe("checkNoSalesCopy", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "standards-gate-sales-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A published package dir with the given description and optional README body. */
  function listed(name: string, description: string, readme?: string): Pkg {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: `@caisson-sh/${name}`, description }),
    );
    if (readme !== undefined) writeFileSync(join(dir, "README.md"), readme);
    return pkg({ name: `@caisson-sh/${name}`, dir, license: APACHE });
  }

  test("a plain description and README pass; `$1` inside code is a placeholder, not a price", () => {
    const readme =
      "# Rls\n\nTenant isolation.\n\n```ts\ndb.query(`SELECT 1 WHERE id = $1`);\n```\n\nUses `$1`/`$2` placeholders.\n";
    expect(
      checkNoSalesCopy([listed("ok", "Tenant isolation over RLS.", readme)]),
    ).toEqual([]);
  });

  test("'commercial' in a description, and a price or 'Commercial' in README prose, are errors", () => {
    const f = checkNoSalesCopy([
      listed("desc", "Commercial billing orchestration."),
      listed("price", "Access reviews.", "Sellable at $199 on its own.\n"),
      listed("tier", "Signing.", "Commercial module. Sits on the kernel.\n"),
    ]);
    expect(f.map((x) => [x.pkg, x.rule])).toEqual([
      ["@caisson-sh/desc", "no-sales-copy"],
      ["@caisson-sh/price", "no-sales-copy"],
      ["@caisson-sh/tier", "no-sales-copy"],
    ]);
    expect(f[1]?.message).toContain("$1");
    expect(f[2]?.message).toContain("README.md");
  });

  test("a private package is out of scope", () => {
    const p = { ...listed("brand", "Commercial glyphs, $5."), private: true };
    expect(checkNoSalesCopy([p])).toEqual([]);
  });

  test("the committed tree is clean, and the check really walked the published set", () => {
    const pkgs = readWorkspace(findRoot(import.meta.dir));
    expect(pkgs.filter((p) => !p.private).length).toBeGreaterThan(40);
    expect(checkNoSalesCopy(pkgs)).toEqual([]);
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
    const p = fixturePkg("@caisson-sh/fixture-clean", "packages/fixture-clean");
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
      "@caisson-sh/fixture-gridwork",
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
      "@caisson-sh/fixture-caisson",
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
    const p = fixturePkg("@caisson-sh/fixture-wave", "packages/fixture-wave");
    writeFileSync(join(p.dir, "AGENTS.md"), "Composes the Wave-0 substrate.\n");
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("Wave-0");
  });

  test("a bare `// see ADR-NNNN` comment is flagged (SS-3)", () => {
    const p = fixturePkg(
      "@caisson-sh/fixture-bare-adr",
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
      "@caisson-sh/fixture-naked-adr",
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
    const p = fixturePkg("@caisson-sh/fixture-desc", "packages/fixture-desc");
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
      "@caisson-sh/fixture-parenthetical",
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
      "@caisson-sh/fixture-desc-parenthetical",
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
    const p = fixturePkg("@caisson-sh/audit-harness", "tooling/audit-harness");
    writeFileSync(
      join(p.dir, "README.md"),
      "gridwork-core CAISSON-99 Wave-0\n",
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("apps/admin is exempt even with a leak", () => {
    const p = fixturePkg("@caisson-sh/admin", "apps/admin");
    writeFileSync(
      join(p.dir, "README.md"),
      "gridwork-core internal ops console.\n",
    );
    expect(checkShippedProse([p], root)).toEqual([]);
  });

  test("apps/site is in scope", () => {
    const p = fixturePkg("@caisson-sh/site", "apps/site");
    writeFileSync(
      join(p.dir, "README.md"),
      "The gridwork-core marketing shell.\n",
    );
    const f = checkShippedProse([p], root);
    expect(f).toHaveLength(1);
  });
});
