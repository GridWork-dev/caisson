// Composition tests for generator DEMO MODE (ADR-0274 §1 / Track E1). Mirrors the fixture-index
// pattern `generate.test.ts` uses (a hand-built RegistryIndex — never the live registry — so the
// suite stays independent of catalog churn). Covers the original SPEC concerns plus the
// fable-security (F1-F3) and code-review (P2-1/2/4/5) fix pass:
//  (a) demo mode generates with a commercial module id present, with no license.
//  (b) the emitted commercial-module files are watermarked stubs, never real commercial source.
//  (c) free/base (oss) modules are unaffected — they install exactly like a licensed build.
//  (d) non-demo generation is unchanged (a pure add, no shared-state leak).
//  F1: `.npmrc` is a tokenless Caisson-registry scope mapping, never public npm / deleted.
//  F2: a hostile module description can't break out of the stub's block comment.
//  F3/P2-2: the stub Proxy is `in`/`Object.keys`/nested-read/await/JSON.stringify safe.
//  P2-1: README/AGENTS no longer imply every listed module is installed / a real dependency.
//  P2-4: `stripPaidDependencies` sweeps all four dependency-map fields, not just `dependencies`.
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { DEMO_WATERMARK, generateDemo, stripPaidDependencies } from "./demo.ts";
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

/** Write `content` to a real temp `.ts` file and import it — proves the stub is valid TS Bun's
 *  own loader accepts, not just that it contains the right substrings. Caller owns cleanup via
 *  the returned `cleanup()`. */
async function importStub(
  content: string,
  filename = "stub.ts",
): Promise<{
  mod: { default: Record<string, unknown> };
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "caisson-demo-stub-"));
  const file = join(dir, filename);
  await writeFile(file, content, "utf8");
  const mod = (await import(file)) as { default: Record<string, unknown> };
  return { mod, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

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

  test("F1: .npmrc is a TOKENLESS Caisson-registry scope mapping, never deleted, never public npm", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const npmrc = files.find((f) => f.path === ".npmrc");
    expect(npmrc).toBeDefined();
    expect(npmrc?.content).toBe(
      "@caisson:registry=https://registry.caisson.sh\n",
    );
    expect(npmrc?.content).not.toContain("_authToken");
    expect(npmrc?.content).not.toContain("CAISSON_LICENSE_TOKEN");
  });

  test("no generated file references CAISSON_LICENSE_TOKEN — the base README's stale licensed-install line is swapped", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const readme = files.find((f) => f.path === "README.md");
    expect(readme?.content).toContain("no license key needed");
    expect(readme?.content).toContain("registry.caisson.sh");
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

  test("a stub file carries the CAISSON DEMO STUB marker + the registry metadata it was derived from, never a real-source marker", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    expect(stub?.content).toContain("CAISSON DEMO STUB");
    expect(stub?.content).toContain("NOT FOR PRODUCTION");
    expect(stub?.content).toContain("@caisson/field-crypto");
    expect(stub?.content).toContain(
      "Field-level envelope encryption for regulated data.",
    );
    expect(stub?.content).toContain("@caisson/kernel"); // its declared dependency
    // The generator's ONLY input is the registry index — no real implementation keyword can
    // possibly appear (there is nothing else to derive content from).
    expect(stub?.content).not.toMatch(/import\s+.*from\s+["']\.\.?\//);
  });

  test("a stub throws at call time for any property, never returning real behavior", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    expect(stub).toBeDefined();
    const { mod, cleanup } = await importStub(
      stub?.content ?? "",
      "field-crypto.ts",
    );
    try {
      const encryptField = mod.default["encryptField"] as (
        ...args: unknown[]
      ) => never;
      expect(() => encryptField()).toThrow(/CAISSON DEMO STUB/);
      expect(() => encryptField()).toThrow(/@caisson\/field-crypto/);
    } finally {
      await cleanup();
    }
  });

  test("F2: a hostile description containing */ cannot break out of the block comment", async () => {
    // Module id deliberately does NOT contain "pwn" — the marker message legitimately embeds the
    // module id/path, so a module id containing the injection payload would make `.not.toThrow`
    // match the wrong thing for the wrong reason.
    const hostile = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        {
          id: "@caisson/hostile-desc",
          latest: "0.1.0",
          versions: [
            version(
              "0.1.0",
              "@caisson/hostile-desc",
              "paid",
              '*/ throw new Error("INJECTED"); /*',
            ),
          ],
        },
      ],
    });
    const { files } = generateDemo(hostile, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/hostile-desc.ts");
    expect(stub).toBeDefined();
    if (stub === undefined) throw new Error("unreachable");
    // The raw `*/` sequence must not survive verbatim in the emitted content — if it did, the
    // import below would either throw a raw "INJECTED" Error (comment broke out) or a syntax
    // error (the injected `throw`/`/*` landed somewhere invalid), never the clean marker throw.
    expect(stub.content).not.toContain('*/ throw new Error("INJECTED")');
    const { mod, cleanup } = await importStub(stub.content, "hostile-desc.ts");
    try {
      const anyProp = mod.default["anything"] as (...args: unknown[]) => never;
      expect(() => anyProp()).toThrow(/CAISSON DEMO STUB/);
      expect(() => anyProp()).not.toThrow(/INJECTED/);
    } finally {
      await cleanup();
    }
  });

  test("F3/P2-2: `in` reports true for any property (never a silent false negative)", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    const { mod, cleanup } = await importStub(
      stub?.content ?? "",
      "field-crypto.ts",
    );
    try {
      expect("anythingAtAll" in mod.default).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("F3/P2-2: Object.keys(stub) does not throw (empty — the real shape is genuinely unknown)", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    const { mod, cleanup } = await importStub(
      stub?.content ?? "",
      "field-crypto.ts",
    );
    try {
      expect(() => Object.keys(mod.default)).not.toThrow();
      expect(Object.keys(mod.default)).toEqual([]);
      expect(() => ({ ...mod.default })).not.toThrow();
    } finally {
      await cleanup();
    }
  });

  test("F3/P2-2: nested-read-then-call throws with the marker (no silent undefined)", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    const { mod, cleanup } = await importStub(
      stub?.content ?? "",
      "field-crypto.ts",
    );
    try {
      const nested = mod.default["config"] as Record<string, unknown>;
      expect(nested).toBeDefined();
      const value = nested["value"] as (...args: unknown[]) => never;
      expect(value).toBeDefined();
      expect(() => value()).toThrow(/CAISSON DEMO STUB/);
      expect(() => value()).toThrow(/@caisson\/field-crypto\.config\.value/);
    } finally {
      await cleanup();
    }
  });

  test("F3/P2-2: await on the stub resolves (never mistaken for a thenable / unhandled rejection)", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    const { mod, cleanup } = await importStub(
      stub?.content ?? "",
      "field-crypto.ts",
    );
    try {
      const resolved = await mod.default;
      expect(resolved).toBe(mod.default);
    } finally {
      await cleanup();
    }
  });

  test("F3/P2-2: JSON.stringify(stub) does not throw", async () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const stub = files.find((f) => f.path === "src/demo-stubs/field-crypto.ts");
    const { mod, cleanup } = await importStub(
      stub?.content ?? "",
      "field-crypto.ts",
    );
    try {
      expect(() => JSON.stringify(mod.default)).not.toThrow();
    } finally {
      await cleanup();
    }
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

  test("P2-1: README/AGENTS no longer imply every listed module is installed", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const readme = files.find((f) => f.path === "README.md");
    const agents = files.find((f) => f.path === "AGENTS.md");
    for (const doc of [readme, agents]) {
      expect(doc?.content).toContain("## Installed modules");
      expect(doc?.content).toContain("DEMO STUBS, not installed dependencies");
    }
  });

  test("P2-1: AGENTS.md's false versioned-dependencies claim is neutralized (pinned demo variant)", () => {
    const { files } = generateDemo(INDEX, { projectName: "acme-demo" });
    const agents = files.find((f) => f.path === "AGENTS.md");
    expect(agents?.content).not.toContain(
      "The installed `@caisson/*` modules are versioned dependencies, not vendored source",
    );
    expect(agents?.content).toContain(
      "Free (oss) `@caisson/*` modules are versioned dependencies — upgrade via `package.json`.",
    );
    expect(agents?.content).toContain(
      "Every commercial module is a LOCAL STUB under `src/demo-stubs/` (editable source, not a",
    );
    expect(agents?.content).toContain("see `DEMO.md`");
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

  test("a plain generate() call still carries the licensed .npmrc (with authToken) and no demo artifacts", () => {
    // Run demo generation FIRST, on the same shared index, to prove it mutates nothing shared.
    generateDemo(INDEX, { projectName: "acme-demo" });
    const { files } = generate(INDEX, BASE);
    const npmrc = files.find((f) => f.path === ".npmrc");
    expect(npmrc?.content).toContain("CAISSON_LICENSE_TOKEN");
    expect(files.find((f) => f.path === "DEMO.md")).toBeUndefined();
    expect(
      files.find((f) => f.path === "src/demo-stubs/kernel.ts"),
    ).toBeUndefined();
    const readme = files.find((f) => f.path === "README.md");
    expect(readme?.content).not.toContain(DEMO_WATERMARK);
    expect(readme?.content).not.toContain("DEMO STUBS, not installed");
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as Record<string, unknown>;
    expect(parsed["caissonDemo"]).toBeUndefined();
  });
});

describe("stripPaidDependencies — P2-4: sweeps ALL FOUR dependency-map fields", () => {
  test("a paid id is removed from dependencies, devDependencies, peerDependencies, AND optionalDependencies", () => {
    const pkg = JSON.stringify({
      name: "acme-demo",
      dependencies: { "@caisson/kernel": "0.1.0", "@caisson/paid-a": "1.0.0" },
      devDependencies: { "@caisson/paid-b": "1.0.0", eslint: "^9.0.0" },
      peerDependencies: { "@caisson/paid-c": "1.0.0" },
      optionalDependencies: { "@caisson/paid-d": "1.0.0" },
    });
    const paidIds = new Set([
      "@caisson/paid-a",
      "@caisson/paid-b",
      "@caisson/paid-c",
      "@caisson/paid-d",
    ]);
    const result = JSON.parse(stripPaidDependencies(pkg, paidIds)) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
      optionalDependencies: Record<string, string>;
      caissonDemo: boolean;
    };

    expect(result.dependencies).toEqual({ "@caisson/kernel": "0.1.0" });
    expect(result.devDependencies).toEqual({ eslint: "^9.0.0" });
    expect(result.peerDependencies).toEqual({});
    expect(result.optionalDependencies).toEqual({});
    expect(result.caissonDemo).toBe(true);

    // Guard: no paid id survives ANYWHERE in the four fields.
    const allDeps = {
      ...result.dependencies,
      ...result.devDependencies,
      ...result.peerDependencies,
      ...result.optionalDependencies,
    };
    for (const paidId of paidIds) {
      expect(allDeps[paidId]).toBeUndefined();
    }
  });

  test("a field absent from the input package.json stays absent in the output (no empty-object injection)", () => {
    const pkg = JSON.stringify({ name: "acme-demo", dependencies: {} });
    const result = JSON.parse(
      stripPaidDependencies(pkg, new Set(["@caisson/x"])),
    ) as Record<string, unknown>;
    expect("peerDependencies" in result).toBe(false);
    expect("optionalDependencies" in result).toBe(false);
    expect("devDependencies" in result).toBe(false);
  });
});
