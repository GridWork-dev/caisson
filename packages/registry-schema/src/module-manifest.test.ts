// The module-manifest contract: exactly {id, version, license, dependencies, description,
// stability}, strict, with the SPDX allowlist as the only license gate. Anything a manifest used to
// carry for selling (tier, price, editions, members) is now an unknown key and rejected.
import { describe, expect, test } from "bun:test";
import {
  SPDX_LICENSES,
  type ModuleManifestInput,
  defineModule,
} from "./module-manifest";

const kernel: ModuleManifestInput = {
  id: "@caisson-sh/kernel",
  version: "0.1.0",
  license: "Apache-2.0",
  dependencies: [],
  description: "Governance kernel fixture.",
};

describe("module manifest", () => {
  test("a minimal manifest parses and fills the defaults", () => {
    expect(
      defineModule({
        id: kernel.id,
        version: kernel.version,
        license: kernel.license,
        description: kernel.description,
      }),
    ).toEqual({
      id: "@caisson-sh/kernel",
      version: "0.1.0",
      license: "Apache-2.0",
      dependencies: [],
      description: "Governance kernel fixture.",
      stability: "alpha",
    });
  });

  test("an explicit stability is kept and an unknown one rejected", () => {
    expect(defineModule({ ...kernel, stability: "stable" }).stability).toBe(
      "stable",
    );
    expect(() =>
      // @ts-expect-error — an off-enum stability, proving the runtime enum rejects it.
      defineModule({ ...kernel, stability: "experimental" }),
    ).toThrow();
  });

  test("the retired selling fields are unknown keys (strict)", () => {
    for (const extra of [
      { tier: "oss" },
      { editions: [] },
      { members: {} },
      { kind: "base" },
      { sellable: true },
    ]) {
      expect(() => defineModule({ ...kernel, ...extra })).toThrow();
    }
  });

  test("a non-semver version and a foreign-scope dependency are rejected", () => {
    expect(() => defineModule({ ...kernel, version: "latest" })).toThrow();
    expect(() =>
      defineModule({ ...kernel, dependencies: ["@stack/kernel"] }),
    ).toThrow();
  });

  test("Apache-2.0 is the only license; anything else (AGPL, the retired commercial id) is rejected", () => {
    expect([...SPDX_LICENSES]).toEqual(["Apache-2.0"]);
    for (const license of [
      "AGPL-3.0-only",
      "Apache 2.0",
      "MIT",
      "LicenseRef-Proprietary",
    ]) {
      expect(() =>
        // @ts-expect-error — off-allowlist SPDX, proving the runtime enum rejects it.
        defineModule({ ...kernel, license }),
      ).toThrow();
    }
  });
});
