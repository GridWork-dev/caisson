import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUNDLE_IDS,
  loadRegistryIndex,
  loadRegistryIndexFromFile,
  type RegistryIndex,
} from "@caisson/registry-schema";
import { matchGolden } from "@caisson/testing";
import {
  type GeneratorEngine,
  generate,
  validateSelection,
} from "./generate.ts";

const manifest = (id: string, version: string) => ({
  id,
  version,
  kind: "primitive" as const,
  editions: [] as never[],
  tier: "paid" as const,
  priceCents: 100,
  license: "LicenseRef-Caisson-Commercial" as const,
  dependencies: [] as never[],
  entry: "src/index.ts",
  agents: "AGENTS.md",
  golden: null,
  stability: "alpha" as const,
  description: "x",
});
const version = (v: string, id: string) => ({
  version: v,
  manifest: manifest(id, v),
  publishedAt: "2026-06-27T00:00:00.000Z",
  gateAttestation: "ci@x",
});

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/field-crypto",
      latest: "0.1.0",
      versions: [version("0.1.0", "@caisson/field-crypto")],
    },
    {
      id: "@caisson/credits",
      latest: "0.2.0",
      versions: [
        version("0.1.0", "@caisson/credits"),
        version("0.2.0", "@caisson/credits"),
      ],
    },
  ],
});

/** A fixed BASE selection (no edition) — golden-fixtured as `generated-fileset`. */
const BASE = {
  projectName: "acme-app",
  modules: [
    { id: "@caisson/field-crypto", version: "0.1.0" },
    { id: "@caisson/credits", version: "0.2.0" },
  ],
};

/** A fixed EDITION selection (compliance) — golden-fixtured as `generated-fileset-compliance`. */
const VALID = {
  ...BASE,
  edition: "compliance",
};

/** An engine that records whether it ran — proves validation precedes materialization. */
function spyEngine(): GeneratorEngine & { called: boolean } {
  return {
    called: false,
    materialize() {
      this.called = true;
      return [];
    },
  };
}

describe("generate — allowlist gate (ADR-0021/0048)", () => {
  test("a BASE selection materializes the real templated repo", () => {
    const { selection, files } = generate(INDEX, BASE);
    expect(selection.projectName).toBe("acme-app");
    const paths = files.map((f) => f.path);
    // The trimmed buyer-repo harness ships its config, CI, AGENTS, and a golden baseline.
    expect(paths).toEqual([
      ".github/workflows/ci.yml",
      ".gitignore",
      ".npmrc",
      ".oxlintrc.json",
      "AGENTS.md",
      "README.md",
      "package.json",
      "src/__golden__/smoke.json",
      "src/golden.test.ts",
      "tsconfig.json",
    ]);
    // Deterministic + sorted (a re-run is byte-identical).
    expect(generate(INDEX, BASE).files).toEqual(files);
  });

  test("WR-01: the generated .npmrc carries the real registry scope + license-token line", () => {
    // Locks the OUTPUT shape: the template source is stored un-dotted (`templates/base/npmrc`,
    // never survives npm packaging as a literal `.npmrc`) and re-dotted to `.npmrc` on read
    // (`readTemplateDir`, engine-templates.ts). This only proves the generation plan is correct —
    // the pack-layer regression itself is asserted in scripts/publish-smoke.test.ts.
    const { files } = generate(INDEX, BASE);
    const npmrc = files.find((f) => f.path === ".npmrc");
    expect(npmrc?.content).toContain(
      "@caisson:registry=https://registry.caisson.sh",
    );
    expect(npmrc?.content).toContain("CAISSON_LICENSE_TOKEN");
  });

  test("an EDITION selection layers the edition's golden fixtures + records caissonEdition", () => {
    const { files } = generate(INDEX, VALID);
    const paths = files.map((f) => f.path);
    // base is always present; the compliance edition adds its own golden baseline.
    expect(paths).toContain("src/__golden__/smoke.json");
    expect(paths).toContain("src/__golden__/evidence.json");
    const pkg = files.find((f) => f.path === "package.json");
    expect(pkg).toBeDefined();
    const parsed = JSON.parse(pkg?.content ?? "{}") as {
      caissonEdition?: string;
      dependencies?: Record<string, string>;
    };
    expect(parsed.caissonEdition).toBe("compliance");
    // The installed modules become sorted dependencies (the selection overlay).
    expect(parsed.dependencies).toEqual({
      "@caisson/credits": "0.2.0",
      "@caisson/field-crypto": "0.1.0",
    });
  });

  test("a BASE selection records NO caissonEdition", () => {
    const { files } = generate(INDEX, BASE);
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as Record<string, unknown>;
    expect(parsed["caissonEdition"]).toBeUndefined();
  });

  test("an unknown module id throws BEFORE the engine runs", () => {
    const engine = spyEngine();
    expect(() =>
      generate(
        INDEX,
        { ...VALID, modules: [{ id: "@caisson/nope", version: "0.1.0" }] },
        engine,
      ),
    ).toThrow(/unknown module id/);
    expect(engine.called).toBe(false);
  });

  test("an unknown VERSION throws BEFORE the engine runs", () => {
    const engine = spyEngine();
    expect(() =>
      generate(
        INDEX,
        {
          ...VALID,
          modules: [{ id: "@caisson/field-crypto", version: "9.9.9" }],
        },
        engine,
      ),
    ).toThrow(/unknown version/);
    expect(engine.called).toBe(false);
  });

  test("a malformed (legacy @stack) id throws before the engine runs", () => {
    const engine = spyEngine();
    expect(() =>
      generate(
        INDEX,
        { ...VALID, modules: [{ id: "@stack/x", version: "0.1.0" }] },
        engine,
      ),
    ).toThrow(/malformed module id/);
    expect(engine.called).toBe(false);
  });

  test("Zod .strict() rejects unknown fields + a bad project name", () => {
    expect(() => validateSelection(INDEX, { ...VALID, rogue: true })).toThrow();
    expect(() =>
      validateSelection(INDEX, { ...VALID, projectName: "Bad Name" }),
    ).toThrow();
    expect(() => validateSelection(INDEX, { ...VALID, modules: [] })).toThrow();
  });

  test("Zod .strict() rejects an unknown deployTarget (ADR-0268)", () => {
    expect(() =>
      validateSelection(INDEX, { ...VALID, deployTarget: "heroku" }),
    ).toThrow();
  });

  test("Zod .strict() rejects an unknown framework (ADR-0287)", () => {
    expect(() =>
      validateSelection(INDEX, { ...VALID, framework: "remix" }),
    ).toThrow();
  });

  test("a duplicate module id (same id, two versions) is rejected", () => {
    const engine = spyEngine();
    expect(() =>
      generate(
        INDEX,
        {
          ...VALID,
          modules: [
            { id: "@caisson/credits", version: "0.1.0" },
            { id: "@caisson/credits", version: "0.2.0" },
          ],
        },
        engine,
      ),
    ).toThrow(/duplicate module id/);
    expect(engine.called).toBe(false);
  });

  test("the BASE file set matches its golden", () => {
    matchGolden(
      import.meta.url,
      "generated-fileset",
      generate(INDEX, BASE).files,
    );
  });

  test("the EDITION (compliance) file set matches its golden", () => {
    matchGolden(
      import.meta.url,
      "generated-fileset-compliance",
      generate(INDEX, VALID).files,
    );
  });
});

describe("generate — six-bundle vocabulary (ADR-0257/0258)", () => {
  test("every canonical bundle id is accepted and normalizes to itself", () => {
    for (const id of BUNDLE_IDS) {
      const selection = validateSelection(INDEX, { ...BASE, edition: id });
      expect(selection.edition).toBe(id);
    }
  });

  test("a dissolved edition id is REJECTED — the generator is six-bundle-only (ADR-0270)", () => {
    // ADR-0270 purged the edition purchase ids and emptied the alias spine, so the generator no longer
    // accepts a legacy `--edition ai-kit`: the input set is exactly the six canonical bundles now.
    for (const legacy of ["ai-kit", "local-ai", "agent-dev", "bundle"]) {
      expect(() =>
        validateSelection(INDEX, { ...BASE, edition: legacy }),
      ).toThrow();
    }
  });

  test("a bundle with no dedicated template overlay (provenance/everything) still generates", () => {
    for (const id of ["provenance", "everything"] as const) {
      const { files } = generate(INDEX, { ...BASE, edition: id });
      const pkg = files.find((f) => f.path === "package.json");
      const parsed = JSON.parse(pkg?.content ?? "{}") as {
        caissonEdition?: string;
      };
      expect(parsed.caissonEdition).toBe(id);
    }
  });

  test("an unknown edition id throws", () => {
    expect(() =>
      validateSelection(INDEX, { ...BASE, edition: "enterprise" }),
    ).toThrow(/edition must be one of/);
  });
});

// The checked-in, CI-built registry index (ADR-0047) — real, index-derived bundle memberships.
// Present only in the private monorepo; absent-by-design in the public mirror (same class as
// registry-schema's own entitlement-expansion.test.ts exclusion). skipIf is evaluated at
// test-DEFINITION time, so probe existence eagerly here — but skipIf still INVOKES the describe
// callback body to enumerate its tests even when skipped, so the actual (possibly-throwing) file
// read must stay lazy, inside beforeAll, not an immediate statement in the callback body (same
// lazy-setup shape as advisory-lock.integration.test.ts's `advisoryLocksSupported` probe).
const REGISTRY_INDEX_PATH = fileURLToPath(
  new URL("../../../registry/index.json", import.meta.url),
);

describe.skipIf(!existsSync(REGISTRY_INDEX_PATH))(
  "validateSelection — edition auto-expand (CAISSON-88 fork (a))",
  () => {
    let realIndex: RegistryIndex;
    beforeAll(() => {
      realIndex = loadRegistryIndexFromFile(REGISTRY_INDEX_PATH);
    });

    test("--edition <bundle> with NO --module auto-populates the bundle's current members", () => {
      const selection = validateSelection(realIndex, {
        projectName: "acme-app",
        edition: "compliance",
        modules: [],
      });
      const ids = selection.modules.map((m) => m.id);
      // real, index-derived compliance members land (not a hand-listed set)
      expect(ids).toContain("@caisson/audit-worm");
      expect(ids).toContain("@caisson/field-crypto");
      expect(ids.length).toBeGreaterThan(1);
      // the bundle META-package itself is a marker, never an installable module → excluded
      expect(ids).not.toContain("@caisson/compliance");
      // every populated module is pinned at its index `.latest` and passes the allowlist gate
      for (const m of selection.modules) {
        const entry = realIndex.modules.find((e) => e.id === m.id);
        expect(m.version).toBe(entry?.latest ?? "MISSING");
      }
      expect(selection.edition).toBe("compliance");
    });

    test("the `everything` bundle expands to installable leaves only (all sub-bundle metas dropped)", () => {
      const selection = validateSelection(realIndex, {
        projectName: "acme-app",
        edition: "everything",
        modules: [],
      });
      const ids = new Set(selection.modules.map((m) => m.id));
      for (const bundle of BUNDLE_IDS) {
        expect(ids.has(`@caisson/${bundle}`)).toBe(false); // no bundle/edition meta ever
      }
      expect(ids.size).toBeGreaterThan(10);
    });

    test("an explicit --module selection is NOT auto-expanded — the buyer's set wins", () => {
      // Derive a served NON-latest kernel version instead of hardcoding one: a version-level
      // delist (ADR-0359) can retire any historical version from the real index, and a non-latest
      // pin is what proves the explicit selection survives without being bumped to latest.
      const kernel = realIndex.modules.find((e) => e.id === "@caisson/kernel");
      if (!kernel)
        throw new Error("@caisson/kernel missing from the real index");
      const pinned =
        kernel.versions
          .map((v) => v.version)
          .find((v) => v !== kernel.latest) ?? kernel.latest;
      const selection = validateSelection(realIndex, {
        projectName: "acme-app",
        edition: "compliance",
        modules: [{ id: "@caisson/kernel", version: pinned }],
      });
      expect(selection.modules).toEqual([
        { id: "@caisson/kernel", version: pinned },
      ]);
    });

    test("a dissolved/unknown edition with empty modules still fails closed", () => {
      for (const bad of ["ai-kit", "enterprise", "bundle"]) {
        expect(() =>
          validateSelection(realIndex, {
            projectName: "acme-app",
            edition: bad,
            modules: [],
          }),
        ).toThrow();
      }
    });
  },
);

describe("generate — deploy templates (ADR-0268)", () => {
  const DEPLOY_FILES = new Set([
    "Dockerfile",
    "railway.toml",
    "fly.toml",
    "Dockerfile.vercel",
  ]);

  test("an unset deployTarget composes NO deploy files — byte-identical to pre-ADR-0268 output", () => {
    const { files } = generate(INDEX, BASE);
    for (const f of files) {
      expect(DEPLOY_FILES.has(f.path)).toBe(false);
    }
    // The existing BASE golden (asserted above) already pins the full path list; this is an
    // explicit ADR-0268 regression lock alongside it.
  });

  for (const target of ["railway", "fly", "vercel"] as const) {
    test(`deployTarget=${target} composes the matching template + matches its golden`, () => {
      const { files } = generate(INDEX, { ...BASE, deployTarget: target });
      matchGolden(import.meta.url, `generated-fileset-deploy-${target}`, files);
    });
  }
});

describe("generate — framework templates (ADR-0287)", () => {
  // Paths that only exist in the Next.js starter — none of these may appear in an unset-framework
  // (byte-identical) compose.
  const FRAMEWORK_FILES = new Set([
    "next.config.ts",
    "next-env.d.ts",
    "src/proxy.ts",
    "src/lib/auth.ts",
    "src/lib/db.ts",
    "src/lib/email.ts",
    "src/lib/jobs.ts",
    "src/lib/ai.ts",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/api/me/route.ts",
    "src/app/api/billing/webhook/route.ts",
    "src/app/actions/notes.ts",
    "src/app/actions/notify.ts",
  ]);

  test("an unset framework composes NO Next.js files — byte-identical to pre-ADR-0287 output", () => {
    const { files } = generate(INDEX, BASE);
    const paths = files.map((f) => f.path);
    for (const f of files) {
      expect(FRAMEWORK_FILES.has(f.path)).toBe(false);
    }
    // The existing BASE golden (asserted above) already pins the full path list byte-for-byte;
    // this is an explicit ADR-0287 regression lock alongside it (mirrors the ADR-0268 deploy lock).
    expect(paths).toEqual([
      ".github/workflows/ci.yml",
      ".gitignore",
      ".npmrc",
      ".oxlintrc.json",
      "AGENTS.md",
      "README.md",
      "package.json",
      "src/__golden__/smoke.json",
      "src/golden.test.ts",
      "tsconfig.json",
    ]);
    expect(generate(INDEX, BASE).files).toEqual(files);
  });

  test("framework=next composes the Next.js starter + matches its golden", () => {
    const { files } = generate(INDEX, { ...BASE, framework: "next" });
    // A stale template and stale golden can agree. Bind the generated pins to
    // workspace versions as well, so omitting the version-PR refresh is loud.
    const template = JSON.parse(
      readFileSync(
        join(import.meta.dir, "../templates/framework/next/package.json"),
        "utf8",
      ),
    ) as { dependencies: Record<string, string> };
    const generated = JSON.parse(
      files.find((file) => file.path === "package.json")?.content ?? "{}",
    ) as {
      dependencies: Record<string, string>;
    };
    const workspacePins: Record<string, string> = {};
    const generatedPins: Record<string, string> = {};
    for (const name of Object.keys(template.dependencies)) {
      if (!name.startsWith("@caisson/")) continue;
      const workspace = JSON.parse(
        readFileSync(
          join(
            import.meta.dir,
            "../../",
            name.slice("@caisson/".length),
            "package.json",
          ),
          "utf8",
        ),
      ) as { version: string };
      workspacePins[name] = `^${workspace.version}`;
      generatedPins[name] = generated.dependencies[name]!;
    }
    expect(Object.keys(workspacePins).length).toBeGreaterThan(0);
    expect(generatedPins).toEqual(workspacePins);
    matchGolden(import.meta.url, "generated-fileset-framework-next", files);
  });

  test("framework=next overrides base's tsconfig/README/AGENTS/.gitignore (root-file collision)", () => {
    const { files } = generate(INDEX, { ...BASE, framework: "next" });
    const tsconfig = files.find((f) => f.path === "tsconfig.json");
    expect(tsconfig?.content).toContain('"plugins": [{ "name": "next" }]');
    const readme = files.find((f) => f.path === "README.md");
    expect(readme?.content).toContain("Next.js App Router");
  });

  test("framework=next's package.json fragment deep-merges with base + the module overlay", () => {
    const { files } = generate(INDEX, { ...BASE, framework: "next" });
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    // base's scripts survive (lint/test); the framework fragment adds dev/build/start.
    expect(parsed.scripts).toMatchObject({
      lint: "oxlint .",
      test: "bun test ./src",
      dev: "next dev",
      build: "next build",
      start: "next start",
    });
    // the buyer's explicit --module selection is present alongside the framework's own deps.
    // The kernel pin is read from the real package rather than hardcoded: this assertion is about
    // COMPOSITION, and a literal here goes stale on every version bump for no added coverage
    // (framework-template-pins.test.ts is what actually guards the pin values).
    const kernelVersion = (
      JSON.parse(
        readFileSync(
          join(import.meta.dir, "../../kernel/package.json"),
          "utf8",
        ),
      ) as { version: string }
    ).version;
    expect(parsed.dependencies).toMatchObject({
      "@caisson/credits": "0.2.0",
      "@caisson/field-crypto": "0.1.0",
      next: "^16.3.3",
      "@caisson/kernel": `^${kernelVersion}`,
    });
    expect(parsed.devDependencies).toMatchObject({
      typescript: "^5.6.0",
      "@types/react": "^19.2.0",
    });
  });

  test("a co-selected deployTarget composes alongside framework=next (base+framework+deploy)", () => {
    const { files } = generate(INDEX, {
      ...BASE,
      framework: "next",
      deployTarget: "railway",
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Dockerfile");
    expect(paths).toContain("railway.toml");
    expect(paths).toContain("src/proxy.ts");
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as {
      scripts?: Record<string, string>;
    };
    // the shared deploy Dockerfile runs `bun run build`/`bun run start` — the framework fragment's
    // scripts make those resolve to `next build`/`next start`.
    expect(parsed.scripts?.build).toBe("next build");
    expect(parsed.scripts?.start).toBe("next start");
  });
});

describe("generate — ADR-0072 buyer-repo boundary", () => {
  // Paths that would only appear if a monorepo-internal surface leaked into a buyer repo.
  const FORBIDDEN_PATH = [
    /build-index/i,
    /append-ledger/i,
    /ledger/i,
    /standards-gate/i,
    /\beval\b/i,
    /publish/i,
  ];
  // Enforcement signatures of the three forbidden surfaces (registry/publish flow, the
  // standards-gate authoring scanner, the eval CI gate). The buyer `.npmrc`'s `registry=` URL is
  // expected and intentionally NOT in this list — the ban is on the publish PIPELINE, not the URL.
  const FORBIDDEN_CONTENT = [
    "bun run gate", // standards-gate authoring scanner invocation
    "tooling/standards-gate",
    "bun run eval", // eval CI gate
    "build-index.ts", // registry publish/index pipeline
    "append-ledger",
    "registry/index.json", // the registry index artifact
    "changeset", // publish-time release gate
  ];

  for (const [name, sel] of [
    ["base", BASE],
    ["compliance", VALID],
    ["framework-next", { ...BASE, framework: "next" }],
  ] as const) {
    test(`emits NONE of the monorepo-internal surfaces (${name})`, () => {
      const { files } = generate(INDEX, sel);
      for (const f of files) {
        for (const rx of FORBIDDEN_PATH) {
          expect(f.path).not.toMatch(rx);
        }
        for (const needle of FORBIDDEN_CONTENT) {
          expect(f.content).not.toContain(needle);
        }
      }

      // The CI that DOES ship is exactly the trimmed set: build · lint · unit · golden.
      const ci = files.find((f) => f.path === ".github/workflows/ci.yml");
      expect(ci).toBeDefined();
      const content = ci?.content ?? "";
      for (const job of ["build:", "lint:", "unit:", "golden:"]) {
        expect(content).toContain(job);
      }
      expect(content).not.toContain("eval:");
      expect(content).not.toContain("standards-gate:");
      expect(content).not.toContain("integration:");
    });
  }
});
