// resolveIndexPath contract tests (delivery-path fix G3). `resolve-index-path.ts` is a pure module
// (only node:fs/node:url) so it can be copied OUTSIDE the monorepo and imported standalone — no
// workspace `node_modules` resolution required — exactly like a real `node_modules/@caisson/cli`
// install. The "simulated installed layout" test below proves the fix: before this change,
// `resolveIndexPath()` only ever looked 3 levels above the package for `registry/index.json`, which
// never exists in a real install.
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveIndexPath } from "./resolve-index-path.ts";

describe("resolveIndexPath — priority order", () => {
  test("CAISSON_REGISTRY_INDEX env override wins over everything", () => {
    const saved = process.env.CAISSON_REGISTRY_INDEX;
    process.env.CAISSON_REGISTRY_INDEX = "/some/override/index.json";
    try {
      expect(resolveIndexPath()).toBe("/some/override/index.json");
    } finally {
      if (saved === undefined) delete process.env.CAISSON_REGISTRY_INDEX;
      else process.env.CAISSON_REGISTRY_INDEX = saved;
    }
  });

  test("falls back to the monorepo dev path when no bundled snapshot exists (this checkout)", () => {
    const saved = process.env.CAISSON_REGISTRY_INDEX;
    delete process.env.CAISSON_REGISTRY_INDEX;
    try {
      // packages/cli/registry-index.json is a gitignored build artifact — absent on a clean
      // checkout unless `bun run build` already ran the bundler.
      const bundled = join(import.meta.dir, "..", "registry-index.json");
      if (!existsSync(bundled)) {
        expect(resolveIndexPath()).toBe(
          join(import.meta.dir, "..", "..", "..", "registry", "index.json"),
        );
      }
    } finally {
      if (saved === undefined) delete process.env.CAISSON_REGISTRY_INDEX;
      else process.env.CAISSON_REGISTRY_INDEX = saved;
    }
  });
});

describe("resolveIndexPath — simulated installed layout (G3 regression)", () => {
  test("resolves the bundled snapshot from a copy OUTSIDE the repo, sibling to the package root", async () => {
    const root = mkdtempSync(join(tmpdir(), "caisson-cli-install-"));
    try {
      // Mirror a real npm install: `dist/` (or `src/`, same depth) sibling to the bundled
      // registry-index.json that `scripts/bundle-registry-index.ts` writes and `package.json`
      // `files` ships. We copy the resolver module VERBATIM — it has zero workspace imports, so
      // it loads standalone with no node_modules present at all, exactly like the real install.
      const srcDir = join(root, "src");
      mkdirSync(srcDir, { recursive: true });
      const moduleSource = readFileSync(
        join(import.meta.dir, "resolve-index-path.ts"),
        "utf8",
      );
      writeFileSync(join(srcDir, "resolve-index-path.ts"), moduleSource);
      writeFileSync(
        join(root, "registry-index.json"),
        '{"schemaVersion":1,"modules":[]}',
      );

      const saved = process.env.CAISSON_REGISTRY_INDEX;
      delete process.env.CAISSON_REGISTRY_INDEX;
      try {
        const mod = (await import(join(srcDir, "resolve-index-path.ts"))) as {
          resolveIndexPath: () => string;
        };
        expect(mod.resolveIndexPath()).toBe(join(root, "registry-index.json"));
      } finally {
        if (saved === undefined) delete process.env.CAISSON_REGISTRY_INDEX;
        else process.env.CAISSON_REGISTRY_INDEX = saved;
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("with no bundled snapshot present, falls back past the install root (would ENOENT in a real install — the pre-fix bug)", async () => {
    const root = mkdtempSync(join(tmpdir(), "caisson-cli-install-noindex-"));
    try {
      const srcDir = join(root, "src");
      mkdirSync(srcDir, { recursive: true });
      const moduleSource = readFileSync(
        join(import.meta.dir, "resolve-index-path.ts"),
        "utf8",
      );
      writeFileSync(join(srcDir, "resolve-index-path.ts"), moduleSource);
      // Deliberately NO registry-index.json sibling — the pre-fix state of a real install.

      const saved = process.env.CAISSON_REGISTRY_INDEX;
      delete process.env.CAISSON_REGISTRY_INDEX;
      try {
        const mod = (await import(join(srcDir, "resolve-index-path.ts"))) as {
          resolveIndexPath: () => string;
        };
        const resolved = mod.resolveIndexPath();
        // Falls back to the "3 levels up" dev path — outside `root` entirely, and absent, proving
        // this branch is only ever reachable from an un-built monorepo checkout, never a real install.
        expect(resolved.startsWith(root)).toBe(false);
        expect(existsSync(resolved)).toBe(false);
      } finally {
        if (saved === undefined) delete process.env.CAISSON_REGISTRY_INDEX;
        else process.env.CAISSON_REGISTRY_INDEX = saved;
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
