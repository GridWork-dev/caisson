import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dir, "..");

describe("site Cloud Run demos contract", () => {
  test("routes demos at runtime instead of baking a cross-origin rewrite", () => {
    const config = readFileSync(resolve(siteRoot, "next.config.ts"), "utf8");
    const dockerfile = readFileSync(resolve(siteRoot, "Dockerfile"), "utf8");

    expect(config).not.toContain("DEMOS_ORIGIN_URL");
    expect(config).not.toContain("async rewrites()");
    expect(dockerfile).not.toContain("ARG DEMOS_ORIGIN_URL");
  });

  test("keeps the registry artifact contract intact", () => {
    const dockerfile = readFileSync(resolve(siteRoot, "Dockerfile"), "utf8");

    expect(dockerfile).toContain(
      "CAISSON_REGISTRY_INDEX_PATH=/app/registry/index.json",
    );
    expect(dockerfile).toContain(
      "COPY --from=build /app/registry/index.json ./registry/index.json",
    );
  });
});
