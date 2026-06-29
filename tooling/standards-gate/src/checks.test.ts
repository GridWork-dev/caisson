// Open-core gate checks (ADR-0094/0097). These lock the license SPLIT (open Base = Apache-2.0, else
// commercial) and the open↔commercial no-depend-up BOUNDARY. Synthetic Pkg[] inputs — no workspace IO.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  checkOpenCoreLicensing,
  checkOpenCommercialBoundary,
  checkManifestAgreement,
} from "./checks";
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
    const cli = pkg({
      name: "@caisson/cli",
      license: COMMERCIAL,
      workspaceDeps: ["@caisson/registry", "@caisson/kernel"],
    });
    const kernel = pkg({ name: "@caisson/kernel", license: APACHE });
    expect(
      checkOpenCommercialBoundary([cli, kernel, commercialRegistry]),
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
