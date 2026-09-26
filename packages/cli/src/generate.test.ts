import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { matchGolden } from "@caisson/testing";
import {
  type GeneratorEngine,
  generate,
  validateSelection,
} from "./generate.ts";

const manifest = (id: string, version: string) => ({
  id,
  version,
  license: "Apache-2.0" as const,
  dependencies: [] as never[],
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

/** A fixed BASE selection — golden-fixtured as `generated-fileset`. */
const BASE = {
  projectName: "acme-app",
  modules: [
    { id: "@caisson/field-crypto", version: "0.1.0" },
    { id: "@caisson/credits", version: "0.2.0" },
  ],
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

  test("modules install from public npm: no .npmrc and no license token anywhere in the output", () => {
    for (const sel of [BASE, { ...BASE, framework: "next" }]) {
      const { files } = generate(INDEX, sel);
      expect(files.some((f) => f.path === ".npmrc")).toBe(false);
      for (const f of files) {
        expect(f.content).not.toContain("CAISSON_LICENSE_TOKEN");
        expect(f.content).not.toContain("registry.caisson.sh");
      }
    }
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
        { ...BASE, modules: [{ id: "@caisson/nope", version: "0.1.0" }] },
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
          ...BASE,
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
        { ...BASE, modules: [{ id: "@stack/x", version: "0.1.0" }] },
        engine,
      ),
    ).toThrow(/malformed module id/);
    expect(engine.called).toBe(false);
  });

  test("Zod .strict() rejects unknown fields + a bad project name", () => {
    expect(() => validateSelection(INDEX, { ...BASE, rogue: true })).toThrow();
    expect(() =>
      validateSelection(INDEX, { ...BASE, projectName: "Bad Name" }),
    ).toThrow();
    expect(() => validateSelection(INDEX, { ...BASE, modules: [] })).toThrow();
  });

  test("Zod .strict() rejects an unknown deployTarget (ADR-0268)", () => {
    expect(() =>
      validateSelection(INDEX, { ...BASE, deployTarget: "heroku" }),
    ).toThrow();
  });

  test("Zod .strict() rejects an unknown framework (ADR-0287)", () => {
    expect(() =>
      validateSelection(INDEX, { ...BASE, framework: "remix" }),
    ).toThrow();
  });

  test("a duplicate module id (same id, two versions) is rejected", () => {
    const engine = spyEngine();
    expect(() =>
      generate(
        INDEX,
        {
          ...BASE,
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
  // standards-gate authoring scanner, the eval CI gate).
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
