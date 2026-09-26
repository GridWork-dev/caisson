// Guards the `@caisson-sh/…` module-id regex against regressing to accept a legacy/foreign
// scope like `@stack/…`, which would break the manifest + allowlist. Asserts the regex in
// BOTH schema sites.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type ModuleManifestInput, defineModule } from "./module-manifest";
import { assertKnownModule, loadRegistryIndex } from "./registry-index";

const validManifest: ModuleManifestInput = {
  id: "@caisson-sh/field-crypto",
  version: "0.1.0",
  license: "Apache-2.0",
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Field encryption column custom-type + per-tenant key derivation.",
};

describe("module-id regex (@caisson-sh)", () => {
  test("a real @caisson-sh/* id parses through defineModule", () => {
    const m = defineModule({ ...validManifest });
    expect(m.id).toBe("@caisson-sh/field-crypto");
  });

  test("a legacy @stack/* id is rejected by the manifest schema", () => {
    expect(() =>
      defineModule({ ...validManifest, id: "@stack/field-crypto" }),
    ).toThrow();
  });

  test("the committed index.example.json validates (it already uses @caisson-sh ids)", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../index.example.json", import.meta.url), "utf8"),
    );
    const index = loadRegistryIndex(raw);
    expect(index.modules.map((m) => m.id)).toContain("@caisson-sh/auth");
  });

  test("assertKnownModule admits a @caisson-sh id in the index, rejects malformed + unknown", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../index.example.json", import.meta.url), "utf8"),
    );
    const index = loadRegistryIndex(raw);
    expect(() => assertKnownModule(index, "@caisson-sh/auth")).not.toThrow();
    expect(() => assertKnownModule(index, "@stack/auth")).toThrow(
      /malformed module id/,
    );
    expect(() => assertKnownModule(index, "@caisson-sh/not-published")).toThrow(
      /unknown module id/,
    );
  });
});
