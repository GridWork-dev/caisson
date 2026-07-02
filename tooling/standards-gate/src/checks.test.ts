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
  checkRlsEquivalence,
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
    const f = checkOpenCoreLicensing([
      pkg({ name: "@caisson/credits", license: COMMERCIAL }),
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
      dir: "/repo/apps/base",
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

describe("checkRlsEquivalence (ADR-0204/0005)", () => {
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

  test("a tenant table with no RLS block at all is rls-missing", () => {
    const p = widgetPkg("");
    const f = checkRlsEquivalence([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("rls-missing");
  });

  test("an RLS block matching buildTenantPolicySql's output exactly is clean", () => {
    const p = widgetPkg(
      buildTenantPolicySql("widget", { column: "account_id", role: "app" }),
    );
    expect(checkRlsEquivalence([p], root)).toEqual([]);
  });

  test("an unlisted narrower-than-generated GRANT is rls-equivalence", () => {
    const p = widgetPkg(narrowGrantSql());
    const f = checkRlsEquivalence([p], root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("rls-equivalence");
  });

  test("a narrower GRANT listed in the overrides file is clean", () => {
    const p = widgetPkg(narrowGrantSql());
    const overridesDir = join(root, "tooling", "standards-gate");
    mkdirSync(overridesDir, { recursive: true });
    writeFileSync(
      join(overridesDir, "rls-equivalence-overrides.json"),
      JSON.stringify([
        { table: "widget", package: p.name, reason: "test fixture" },
      ]),
    );
    expect(checkRlsEquivalence([p], root)).toEqual([]);
  });
});
