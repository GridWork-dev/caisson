import { expect, test } from "bun:test";
import { checkPackageContents, extensionlessImports } from "./package-contents";

const pkg = {
  name: "@caisson-sh/example",
  exports: {
    ".": {
      bun: "./src/index.ts",
      types: "./dist/index.d.ts",
      default: "./dist/index.js",
    },
    "./components/*": "./src/components/*",
  },
  bin: { example: "./dist/cli.js" },
};
const clean = [
  "package.json",
  "README.md",
  "src/index.ts",
  "src/components/button.tsx",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/cli.js",
];

test("a tarball with only runtime files passes", () => {
  expect(() => checkPackageContents(pkg, clean)).not.toThrow();
});

test("test, story, fixture and build files are refused", () => {
  for (const stray of [
    "src/index.test.ts",
    "dist/index.integration.test.js.map",
    "src/button.stories.tsx",
    "src/__golden__/out.json",
    "dist/__fixtures__/stub.js",
    ".turbo/turbo-build.log",
    "tsconfig.json",
  ]) {
    expect(() => checkPackageContents(pkg, [...clean, stray])).toThrow(stray);
  }
});

test("the generator templates keep their own tests", () => {
  expect(() =>
    checkPackageContents(pkg, [
      ...clean,
      "templates/base/src/golden.test.ts",
      "templates/base/tsconfig.json",
    ]),
  ).not.toThrow();
});

test("a missing export, wildcard export or bin target is refused", () => {
  for (const [dropped, target] of [
    ["src/index.ts", "src/index.ts"],
    ["src/components/button.tsx", "src/components/*"],
    ["dist/cli.js", "dist/cli.js"],
  ]) {
    expect(() =>
      checkPackageContents(
        pkg,
        clean.filter((entry) => entry !== dropped),
      ),
    ).toThrow(target);
  }
});

test("relative imports without a file extension are found; bare and extended ones are not", () => {
  const source = [
    'export * from "./module-manifest";',
    'export { a } from "./a.js";',
    'import { z } from "zod";',
    'import "./side-effect";',
    'const lazy = await import("../lazy");',
    'import data from "./data.json";',
    'import { b } from "../b/index.js";',
    '/** The key for {@link import("./idempotency.ts").claim}. */',
    '// import "./commented-out";',
  ].join("\n");
  expect(extensionlessImports(source)).toEqual([
    "./module-manifest",
    "./side-effect",
    "../lazy",
  ]);
});
