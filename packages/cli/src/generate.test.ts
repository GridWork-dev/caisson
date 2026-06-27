import { describe, expect, test } from "bun:test";
import { loadRegistryIndex } from "@caisson/registry";
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

const VALID = {
  projectName: "acme-app",
  edition: "compliance",
  modules: [
    { id: "@caisson/field-crypto", version: "0.1.0" },
    { id: "@caisson/credits", version: "0.2.0" },
  ],
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
  test("a valid selection produces the workspace skeleton", () => {
    const { selection, files } = generate(INDEX, VALID);
    expect(selection.projectName).toBe("acme-app");
    expect(files.map((f) => f.path)).toEqual([
      ".npmrc",
      "README.md",
      "package.json",
    ]);
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

  test("the generated file set matches its golden", () => {
    matchGolden(
      import.meta.url,
      "generated-fileset",
      generate(INDEX, VALID).files,
    );
  });
});
