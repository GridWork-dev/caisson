import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("the public package surface", () => {
  test("publishes a supported browser entry", () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dir, "../package.json"), "utf8"),
    ) as {
      exports?: Record<string, unknown>;
      engines?: { node?: string };
    };

    expect(manifest.exports?.["./browser"]).toEqual({
      bun: "./src/browser.ts",
      types: "./dist/browser.d.ts",
      default: "./dist/browser.js",
    });
    expect(manifest.engines?.node).toBe(">=20.12.0");
  });
});
