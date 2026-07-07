// Composition tests for generator DEMO MODE (ADR-0274 §1 / Track E1). Mirrors the fixture-index
// pattern `generate.test.ts` uses (a hand-built RegistryIndex — never the live registry — so the
// suite stays independent of catalog churn). Four concerns, per the SPEC:
//  (a) demo mode generates with a commercial module id present, with no license.
//  (b) the emitted commercial-module files are watermarked stubs, never real commercial source.
//  (c) free/base (oss) modules are unaffected — they install exactly like a licensed build.
//  (d) non-demo generation is byte-for-byte unchanged (a pure add, no shared-state leak).
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { DEMO_WATERMARK, generateDemo } from "./demo.ts";
import { generate } from "./generate.ts";

const manifest = (
  id: string,
  version: string,
  tier: "oss" | "paid",
  description: string,
  dependencies: string[] = [],
) => ({
  id,
  version,
  kind: "primitive" as const,
  editions: [] as never[],
  tier,
  priceCents: tier === "paid" ? 100 : null,
  license:
    tier === "paid"
      ? ("LicenseRef-Caisson-Commercial" as const)
      : ("Apache-2.0" as const),
  dependencies,
  entry: "src/index.ts",
  agents: "AGENTS.md",
  golden: null,
  stability: "alpha" as const,
  description,
});
const version = (
  v: string,
  id: string,
  tier: "oss" | "paid",
  description: string,
  dependencies: string[] = [],
) => ({
  version: v,
  manifest: manifest(id, v, tier, description, dependencies),
  publishedAt: "2026-07-07T00:00:00.000Z",
  gateAttestation: "ci@x",
});

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/kernel",
      latest: "0.1.0",
      versions: [
        version(
          "0.1.0",
          "@caisson/kernel",
          "oss",
          "The open audit-chain kernel.",
        ),
      ],
    },
    {
      id: "@caisson/auth",
      latest: "0.2.0",
      versions: [
        version("0.2.0", "@caisson/auth", "oss", "Open auth primitives.", [
          "@caisson/kernel",
        ]),
      ],
    },
    {
      id: "@caisson/field-crypto",
      latest: "0.3.0",
      versions: [
        version(
          "0.3.0",
          "@caisson/field-crypto",
          "paid",
          "Field-level envelope encryption for regulated data.",
          ["@caisson/kernel"],
        ),
      ],
    },
    {
      id: "@caisson/audit-worm",
      latest: "0.4.0",
      versions: [
        version(
          "0.4.0",
          "@caisson/audit-worm",
          "paid",
          "Write-once-read-many audit anchoring.",
        ),
      ],
    },
  ],
});

describe("generateDemo — (a) demo mode composes with commercial module ids, no license", () => {
  test("the catalog includes every registry module, oss and paid alike", () => {
    const { modules } = generateDemo(INDEX, { projectName: "acme-demo" });
    expect(modules.map((m) => m.id).sort()).toEqual([
      "@caisson/audit-worm",
      "@caisson/auth",
      "@caisson/field-crypto",
      "@caisson/kernel",
    ]);
    expect(modules.filter((m) => m.tier === "paid").length).toBe(2);
    expect(modules.filter((m) => m.tier === "oss").length).toBe(2);
  });

  test("no commercial-registry auth is required — .npmrc is dropped entirely", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    expect(files.find((f) => f.path === ".npmrc")).toBeUndefined();
  });

  test("no generated file references CAISSON_LICENSE_TOKEN — the base README's stale licensed-install line is swapped", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const readme = files.find((f) => f.path === "README.md");
    expect(readme?.content).toContain("no license needed");
    for (const f of files) {
      expect(f.content).not.toContain("CAISSON_LICENSE_TOKEN");
    }
  });

  test("generation succeeds and produces a deterministic, sorted file set", () => {
    const run1 = generateDemo(INDEX, { projectName: "acme-demo" });
    const run2 = generateDemo(INDEX, { projectName: "acme-demo" });
    expect(run1.files).toEqual(run2.files);
    const paths = run1.files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
  });
});

describe("generateDemo — (b) commercial modules are watermarked stubs, never real source", () => {
  test("every paid module gets a stub file under src/demo-stubs/, none get a package.json dependency", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const fieldCryptoStub = files.find(
      (f) => f.path === "src/demo-stubs/field-crypto.ts",
    );
    const auditWormStub = files.find(
      (f) => f.path === "src/demo-stubs/audit-worm.ts",
    );
    expect(fieldCryptoStub).toBeDefined();
    expect(auditWormStub).toBeDefined();

    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as {
      dependencies?: Record<string, string>;
    };
    expect(parsed.dependencies?.["@caisson/field-crypto"]).toBeUndefined();
    expect(parsed.dependencies?.["@caisson/audit-worm"]).toBeUndefined();
  });

  test("a stub file carries the CAISSON DEMO STUB marker + the registry metadata it was derived from", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    expect(stub?.content).toContain("CAISSON DEMO STUB");
    expect(stub?.content).toContain("NOT FOR PRODUCTION");
    expect(stub?.content).toContain("@caisson/field-crypto");
    expect(stub?.content).toContain(
      "Field-level envelope encryption for regulated data.",
    );
    expect(stub?.content).toContain("@caisson/kernel"); // its declared dependency
  });

  test("a stub throws at call time for any property, never returning real behavior", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    expect(stub).toBeDefined();
    // Write the ACTUAL generated content to a real .ts file and import it — proves the stub is
    // valid TS that Bun's own loader accepts, and that invoking it throws with the marker, not
    // that it merely contains the right substring.
    const dir = await mkdtemp(join(tmpdir(), "caisson-demo-stub-"));
    const file = join(dir, "field-crypto.ts");
    try {
      await writeFile(file, stub?.content ?? "", "utf8");
      const mod = (await import(file)) as {
        // A named property (not an index signature) — sidesteps noUncheckedIndexedAccess, and
        // matches exactly what's under test: the stub's `encryptField` property access.
        default: { encryptField: (...args: unknown[]) => never };
      };
      expect(() => mod.default.encryptField()).toThrow(/CAISSON DEMO STUB/);
      expect(() => mod.default.encryptField()).toThrow(
        /@caisson\/field-crypto/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("stub content never contains a real-source marker — it is a synthesis from metadata only", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/audit-worm.ts");
    // The generator's ONLY input is the registry index (id/description/dependencies) — assert the
    // stub is exactly the synthesized template, not a hand-authored or copied implementation.
    expect(stub?.content).toBe(`/**
 * CAISSON DEMO STUB — NOT FOR PRODUCTION
 *
 * Stand-in for the commercial module below. 'create-caisson --demo' never reads or downloads
 * Caisson's commercial source; every export here is synthesized from public registry metadata
 * and throws at call time. Get a license at https://caisson.sh to install the real module.
 *
 * Module:       @caisson/audit-worm
 * Description:  Write-once-read-many audit anchoring.
 * Dependencies: (none)
 */

function demoStub(moduleId: string): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_target: object, prop: string | symbol): unknown {
        if (typeof prop !== "string") return undefined;
        return (..._args: unknown[]): never => {
          throw new Error(
            "CAISSON DEMO STUB: " +
              moduleId +
              "." +
              prop +
              "() is not implemented — this is a demo scaffold, not the licensed module. Get a " +
              "license at https://caisson.sh",
          );
        };
      },
    },
  ) as Record<string, unknown>;
}

/** Every import from this module resolves here — every call throws the CAISSON DEMO STUB marker. */
export default demoStub("@caisson/audit-worm");
`);
  });

  test("README.md, AGENTS.md, and a root DEMO.md all carry the not-for-production watermark", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const readme = files.find((f) => f.path === "README.md");
    const agents = files.find((f) => f.path === "AGENTS.md");
    const demoDoc = files.find((f) => f.path === "DEMO.md");
    expect(readme?.content).toContain(DEMO_WATERMARK);
    expect(agents?.content).toContain(DEMO_WATERMARK);
    expect(demoDoc?.content).toContain(DEMO_WATERMARK);
    // DEMO.md enumerates the whole catalog, oss AND stubbed.
    expect(demoDoc?.content).toContain("@caisson/field-crypto");
    expect(demoDoc?.content).toContain("@caisson/kernel");
  });
});

describe("generateDemo — (c) free/base (oss) modules are unaffected", () => {
  test("oss modules install exactly like a licensed build — real package.json dependency, no stub", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as {
      dependencies?: Record<string, string>;
    };
    expect(parsed.dependencies?.["@caisson/kernel"]).toBe("0.1.0");
    expect(parsed.dependencies?.["@caisson/auth"]).toBe("0.2.0");
    expect(
      files.find((f) => f.path === "src/demo-stubs/kernel.ts"),
    ).toBeUndefined();
    expect(
      files.find((f) => f.path === "src/demo-stubs/auth.ts"),
    ).toBeUndefined();
  });
});

describe("generateDemo — (d) non-demo generation is unchanged (regression)", () => {
  const BASE = {
    projectName: "acme-app",
    modules: [{ id: "@caisson/kernel", version: "0.1.0" }],
  };

  test("a plain generate() call still carries .npmrc and no demo artifacts", () => {
    // Run demo generation FIRST, on the same shared index, to prove it mutates nothing shared.
    generateDemo(INDEX, { projectName: "acme-demo" });
    const { files } = generate(INDEX, BASE);
    expect(files.find((f) => f.path === ".npmrc")).toBeDefined();
    expect(files.find((f) => f.path === "DEMO.md")).toBeUndefined();
    expect(
      files.find((f) => f.path === "src/demo-stubs/kernel.ts"),
    ).toBeUndefined();
    const readme = files.find((f) => f.path === "README.md");
    expect(readme?.content).not.toContain(DEMO_WATERMARK);
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as Record<string, unknown>;
    expect(parsed["caissonDemo"]).toBeUndefined();
  });
});
