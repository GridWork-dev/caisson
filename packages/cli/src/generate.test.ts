import { describe, expect, test } from "bun:test";
import { BUNDLE_IDS, loadRegistryIndex } from "@caisson/registry-schema";
import { matchGolden } from "@caisson/testing";
import {
  type GeneratorEngine,
  defaultEngine,
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
    materialize(selection) {
      this.called = true;
      return defaultEngine.materialize(selection);
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
      "AGENTS.md",
      "README.md",
      "eslint.config.js",
      "package.json",
      "src/__golden__/smoke.json",
      "src/golden.test.ts",
      "tsconfig.json",
    ]);
    // Deterministic + sorted (a re-run is byte-identical).
    expect(generate(INDEX, BASE).files).toEqual(files);
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
