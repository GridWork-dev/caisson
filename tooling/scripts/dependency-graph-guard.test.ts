import { describe, expect, test } from "bun:test";
import {
  assertDependencyGraphCoverage,
  parseDependencyCruiserInfo,
} from "./dependency-graph-guard";

describe("dependency graph guard", () => {
  test("requires the TypeScript transpiler and TypeScript extensions", () => {
    const enabled = parseDependencyCruiserInfo(`
✔ transpiler             versions supported  version found
✔ typescript             >=2.0.0 <7.0.0      6.0.3

✔ extension
✔ .ts
✔ .tsx
`);
    expect(enabled).toEqual({
      typescriptVersion: "6.0.3",
      ts: true,
      tsx: true,
    });

    expect(() =>
      parseDependencyCruiserInfo(`
x typescript             >=2.0.0 <7.0.0      -
x .ts
x .tsx
`),
    ).toThrow("TypeScript transpiler is disabled");
  });

  test("rejects a JavaScript-only false-green graph", () => {
    expect(() =>
      assertDependencyGraphCoverage(
        {
          modules: [
            { source: "tooling/eslint-config/index.js", dependencies: [] },
            { source: "apps/site/next.config.ts", dependencies: [] },
          ],
        },
        {
          minimumModules: 8,
          minimumTypeScriptModules: 5,
          minimumDependencies: 8,
          sentinels: [
            "packages/kernel/src/index.ts",
            "apps/site/app/layout.tsx",
            "tooling/standards-gate/src/cli.ts",
          ],
        },
      ),
    ).toThrow("only 2 modules");
  });

  test("requires representative package, app, and tooling TypeScript sentinels", () => {
    const graph = {
      modules: Array.from({ length: 8 }, (_, index) => ({
        source: `packages/example/src/file-${index}.ts`,
        dependencies: [
          { resolved: `packages/example/src/file-${index + 1}.ts` },
        ],
      })),
    };

    expect(() =>
      assertDependencyGraphCoverage(graph, {
        minimumModules: 8,
        minimumTypeScriptModules: 8,
        minimumDependencies: 8,
        sentinels: [
          "packages/kernel/src/index.ts",
          "apps/site/app/layout.tsx",
          "tooling/standards-gate/src/cli.ts",
        ],
      }),
    ).toThrow("missing TypeScript sentinels");

    graph.modules.push(
      { source: "packages/kernel/src/index.ts" },
      { source: "apps/site/app/layout.tsx" },
      { source: "tooling/standards-gate/src/cli.ts" },
    );

    expect(() =>
      assertDependencyGraphCoverage(graph, {
        minimumModules: 8,
        minimumTypeScriptModules: 8,
        minimumDependencies: 8,
        sentinels: [
          "packages/kernel/src/index.ts",
          "apps/site/app/layout.tsx",
          "tooling/standards-gate/src/cli.ts",
        ],
      }),
    ).not.toThrow();
  });

  test("requires realistic TypeScript and dependency coverage", () => {
    const modules = [
      {
        source: "packages/kernel/src/index.ts",
        dependencies: [{ resolved: "packages/kernel/src/runtime.ts" }],
      },
      {
        source: "apps/site/app/layout.tsx",
        dependencies: [{ resolved: "packages/ui/src/index.ts" }],
      },
      {
        source: "tooling/standards-gate/src/cli.ts",
        dependencies: [],
      },
      { source: "tooling/eslint-config/index.js", dependencies: [] },
    ];

    expect(() =>
      assertDependencyGraphCoverage(
        { modules },
        {
          minimumModules: 4,
          minimumTypeScriptModules: 4,
          minimumDependencies: 2,
          sentinels: [
            "packages/kernel/src/index.ts",
            "apps/site/app/layout.tsx",
            "tooling/standards-gate/src/cli.ts",
          ],
        },
      ),
    ).toThrow("only 3 TypeScript modules");

    expect(() =>
      assertDependencyGraphCoverage(
        { modules },
        {
          minimumModules: 4,
          minimumTypeScriptModules: 3,
          minimumDependencies: 3,
          sentinels: [
            "packages/kernel/src/index.ts",
            "apps/site/app/layout.tsx",
            "tooling/standards-gate/src/cli.ts",
          ],
        },
      ),
    ).toThrow("only 2 dependencies");
  });
});
