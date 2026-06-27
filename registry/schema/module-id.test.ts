// Regression for the @stack→@caisson module-id fix (Wave-0). The old `/^@stack\/…/` regex rejected
// every real `@caisson/…` id, which would break the manifest + allowlist the moment a real module
// manifest landed. These assert the corrected regex in BOTH schema sites.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type ModuleManifestInput, defineModule } from "./module-manifest";
import { assertKnownModule, loadRegistryIndex } from "./registry-index";

const validManifest: ModuleManifestInput = {
  id: "@caisson/field-crypto",
  version: "0.1.0",
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel"],
  description:
    "Field encryption column custom-type + per-tenant key derivation.",
};

describe("module-id regex (@caisson)", () => {
  test("a real @caisson/* id parses through defineModule", () => {
    const m = defineModule({ ...validManifest });
    expect(m.id).toBe("@caisson/field-crypto");
  });

  test("a legacy @stack/* id is rejected by the manifest schema", () => {
    expect(() =>
      defineModule({ ...validManifest, id: "@stack/field-crypto" }),
    ).toThrow();
  });

  test("the committed index.example.json validates (it already uses @caisson ids)", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../index.example.json", import.meta.url), "utf8"),
    );
    const index = loadRegistryIndex(raw);
    expect(index.modules.map((m) => m.id)).toContain("@caisson/auth");
  });

  test("assertKnownModule admits a @caisson id in the index, rejects malformed + unknown", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../index.example.json", import.meta.url), "utf8"),
    );
    const index = loadRegistryIndex(raw);
    expect(() => assertKnownModule(index, "@caisson/auth")).not.toThrow();
    expect(() => assertKnownModule(index, "@stack/auth")).toThrow(
      /malformed module id/,
    );
    expect(() => assertKnownModule(index, "@caisson/not-published")).toThrow(
      /unknown module id/,
    );
  });
});
