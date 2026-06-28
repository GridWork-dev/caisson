import { describe, expect, test } from "bun:test";
import { type JsonObject, deepMerge, replaceTokens } from "./transform.ts";

// ── replaceTokens ─────────────────────────────────────────────────────────────

describe("replaceTokens — token substitution", () => {
  test("replaces all known tokens in one pass", () => {
    const { content, unresolved } = replaceTokens(
      "Hello {{name}}, your project is {{projectName}}.",
      { name: "World", projectName: "my-app" },
    );
    expect(content).toBe("Hello World, your project is my-app.");
    expect(unresolved.size).toBe(0);
  });

  test("unknown tokens are left verbatim and reported in unresolved", () => {
    const { content, unresolved } = replaceTokens(
      "{{known}} + {{unknown}} + {{alsoUnknown}}",
      { known: "value" },
    );
    expect(content).toBe("value + {{unknown}} + {{alsoUnknown}}");
    expect(unresolved.has("unknown")).toBe(true);
    expect(unresolved.has("alsoUnknown")).toBe(true);
    expect(unresolved.size).toBe(2);
  });

  test("all tokens unknown — full passthrough (no error)", () => {
    const { content, unresolved } = replaceTokens("{{foo}} {{bar}}", {});
    expect(content).toBe("{{foo}} {{bar}}");
    expect(unresolved.size).toBe(2);
  });

  test("no placeholders in template — content unchanged, unresolved empty", () => {
    const { content, unresolved } = replaceTokens("no tokens here", {});
    expect(content).toBe("no tokens here");
    expect(unresolved.size).toBe(0);
  });

  test("repeated known token is replaced everywhere", () => {
    const { content, unresolved } = replaceTokens("{{x}}{{x}}{{x}}", {
      x: "a",
    });
    expect(content).toBe("aaa");
    expect(unresolved.size).toBe(0);
  });

  test("repeated unknown token appears exactly once in unresolved", () => {
    const { content, unresolved } = replaceTokens("{{miss}}{{miss}}", {});
    expect(content).toBe("{{miss}}{{miss}}");
    expect(unresolved.size).toBe(1);
    expect(unresolved.has("miss")).toBe(true);
  });

  test("empty string template is a no-op", () => {
    const { content, unresolved } = replaceTokens("", { x: "y" });
    expect(content).toBe("");
    expect(unresolved.size).toBe(0);
  });

  test("token value may itself contain braces without being re-processed", () => {
    // substitution is a single-pass regex replace — the replacement value is not
    // re-scanned for further placeholders
    const { content } = replaceTokens("{{a}}", { a: "{{b}}", b: "boom" });
    expect(content).toBe("{{b}}");
  });
});

// ── deepMerge ─────────────────────────────────────────────────────────────────

describe("deepMerge — deterministic JSON deep-merge", () => {
  test("override scalar wins over base scalar", () => {
    const result = deepMerge({ version: "1.0.0" }, { version: "2.0.0" });
    expect(result).toEqual({ version: "2.0.0" });
  });

  test("key only in base is preserved", () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99 });
    expect(result).toEqual({ a: 1, b: 99 });
  });

  test("key only in override is added", () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test("nested objects are merged recursively", () => {
    const result = deepMerge(
      { compilerOptions: { strict: true, target: "ES2020" } },
      { compilerOptions: { module: "NodeNext", target: "ES2022" } },
    );
    expect(result).toEqual({
      compilerOptions: { module: "NodeNext", strict: true, target: "ES2022" },
    });
  });

  test("array REPLACE — override array wholly replaces base array", () => {
    const result = deepMerge(
      { include: ["src/**/*"] },
      { include: ["src/**/*", "tests/**/*"] },
    );
    expect(result).toEqual({ include: ["src/**/*", "tests/**/*"] });
  });

  test("array REPLACE — base array is dropped entirely when override array present", () => {
    const result = deepMerge(
      { workspaces: ["packages/a", "packages/b", "packages/c"] },
      { workspaces: ["packages/x"] },
    );
    expect(result["workspaces"]).toEqual(["packages/x"]);
  });

  test("output object keys are sorted lexicographically (deterministic)", () => {
    const result = deepMerge(
      { zebra: 1, alpha: 2, middle: 3 },
      { new: 4, also: 5 },
    );
    expect(Object.keys(result)).toEqual([
      "alpha",
      "also",
      "middle",
      "new",
      "zebra",
    ]);
  });

  test("nested object keys are also sorted", () => {
    const result = deepMerge(
      { config: { zz: 1, aa: 2 } },
      { config: { mm: 3 } },
    );
    const config = result["config"] as JsonObject;
    expect(Object.keys(config)).toEqual(["aa", "mm", "zz"]);
  });

  test("package.json-style merge: dependencies deep-merged, name overridden", () => {
    const result = deepMerge(
      {
        name: "base",
        dependencies: { react: "^18", "react-dom": "^18" },
        scripts: { build: "tsc" },
      },
      {
        name: "override",
        dependencies: { "react-dom": "^19" },
        scripts: { build: "vite build", test: "vitest" },
      },
    );
    expect(result).toEqual({
      dependencies: { react: "^18", "react-dom": "^19" },
      name: "override",
      scripts: { build: "vite build", test: "vitest" },
    });
  });

  test("null values are preserved as-is", () => {
    const result = deepMerge({ a: null }, { b: null });
    expect(result).toEqual({ a: null, b: null });
  });

  test("merging two empty objects yields an empty object", () => {
    const result = deepMerge({}, {});
    expect(result).toEqual({});
  });

  test("merging over an empty base returns override keys sorted", () => {
    const result = deepMerge({}, { z: 1, a: 2 });
    expect(Object.keys(result)).toEqual(["a", "z"]);
  });

  test("same inputs in different insertion order produce identical output", () => {
    const a = deepMerge({ x: { c: 3, a: 1 }, b: 2 }, { x: { b: 9 } });
    const b = deepMerge({ b: 2, x: { a: 1, c: 3 } }, { x: { b: 9 } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.keys(a)).toEqual(["b", "x"]);
    expect(Object.keys(a["x"] as JsonObject)).toEqual(["a", "b", "c"]);
  });
});
