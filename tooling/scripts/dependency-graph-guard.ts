import { execFileSync } from "node:child_process";
import { join } from "node:path";

export interface DependencyCruiserInfo {
  typescriptVersion: string;
  ts: boolean;
  tsx: boolean;
}

export interface DependencyGraphGuardOptions {
  minimumModules: number;
  minimumTypeScriptModules: number;
  minimumDependencies: number;
  sentinels: readonly string[];
}

interface DependencyCruiserModule {
  source: string;
  dependencies: readonly unknown[];
}

interface DependencyCruiserGraph {
  modules: DependencyCruiserModule[];
}

export interface DependencyGraphCoverage {
  modules: number;
  typescriptModules: number;
  dependencies: number;
}

const DEFAULT_OPTIONS: DependencyGraphGuardOptions = {
  minimumModules: 2_000,
  minimumTypeScriptModules: 1_500,
  minimumDependencies: 6_000,
  sentinels: [
    "packages/kernel/src/index.ts",
    "apps/site/app/layout.tsx",
    "tooling/standards-gate/src/cli.ts",
  ],
};

export function parseDependencyCruiserInfo(
  output: string,
): DependencyCruiserInfo {
  const version =
    /^\s*✔\s+typescript\s+.*\s+(?:typescript@)?(\d+\.\d+\.\d+)\s*$/m.exec(
      output,
    )?.[1];
  if (!version) {
    throw new Error(
      "dependency-cruiser TypeScript transpiler is disabled; refusing a JavaScript-only false green",
    );
  }

  const ts = /^\s*✔\s+\.ts\s*$/m.test(output);
  const tsx = /^\s*✔\s+\.tsx\s*$/m.test(output);
  if (!ts || !tsx) {
    throw new Error(
      "dependency-cruiser TypeScript extensions are disabled; both .ts and .tsx must be enabled",
    );
  }

  return { typescriptVersion: version, ts, tsx };
}

function parseDependencyCruiserGraph(input: unknown): DependencyCruiserGraph {
  if (typeof input !== "object" || input === null) {
    throw new Error("dependency-cruiser graph must be an object");
  }
  const modules = Reflect.get(input, "modules");
  if (!Array.isArray(modules)) {
    throw new Error("dependency-cruiser graph must contain a modules array");
  }

  return {
    modules: modules.map((module, index) => {
      if (typeof module !== "object" || module === null) {
        throw new Error(`dependency-cruiser module ${index} must be an object`);
      }
      const source = Reflect.get(module, "source");
      if (typeof source !== "string" || source.length === 0) {
        throw new Error(
          `dependency-cruiser module ${index} must contain a source string`,
        );
      }
      const dependencies = Reflect.get(module, "dependencies");
      if (dependencies !== undefined && !Array.isArray(dependencies)) {
        throw new Error(
          `dependency-cruiser module ${index} dependencies must be an array`,
        );
      }
      return { source, dependencies: dependencies ?? [] };
    }),
  };
}

export function assertDependencyGraphCoverage(
  input: unknown,
  options: DependencyGraphGuardOptions = DEFAULT_OPTIONS,
): DependencyGraphCoverage {
  const graph = parseDependencyCruiserGraph(input);
  if (graph.modules.length < options.minimumModules) {
    throw new Error(
      `dependency-cruiser emitted only ${graph.modules.length} modules; expected at least ${options.minimumModules}`,
    );
  }

  const typescriptModules = graph.modules.filter((module) =>
    /\.[cm]?tsx?$/.test(module.source),
  ).length;
  if (typescriptModules < options.minimumTypeScriptModules) {
    throw new Error(
      `dependency-cruiser emitted only ${typescriptModules} TypeScript modules; expected at least ${options.minimumTypeScriptModules}`,
    );
  }

  const dependencies = graph.modules.reduce(
    (total, module) => total + module.dependencies.length,
    0,
  );
  if (dependencies < options.minimumDependencies) {
    throw new Error(
      `dependency-cruiser emitted only ${dependencies} dependencies; expected at least ${options.minimumDependencies}`,
    );
  }

  const sources = new Set(graph.modules.map((module) => module.source));
  const missing = options.sentinels.filter((source) => !sources.has(source));
  if (missing.length > 0) {
    throw new Error(
      `dependency-cruiser graph is missing TypeScript sentinels: ${missing.join(", ")}`,
    );
  }

  return {
    modules: graph.modules.length,
    typescriptModules,
    dependencies,
  };
}

export function runDependencyGraphGuard(): void {
  const depcruise = join(process.cwd(), "node_modules", ".bin", "depcruise");
  const infoOutput = execFileSync(depcruise, ["--info"], {
    encoding: "utf8",
  });
  const info = parseDependencyCruiserInfo(infoOutput);

  const graphOutput = execFileSync(
    depcruise,
    [
      "packages",
      "apps",
      "tooling",
      "--config",
      ".dependency-cruiser.cjs",
      "--output-type",
      "json",
    ],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const coverage = assertDependencyGraphCoverage(
    JSON.parse(graphOutput) as unknown,
  );
  process.stdout.write(
    `dependency graph coverage: TypeScript ${info.typescriptVersion}; ${coverage.modules} modules; ${coverage.typescriptModules} TypeScript modules; ${coverage.dependencies} dependencies; sentinels present\n`,
  );
}

if (import.meta.main) {
  runDependencyGraphGuard();
}
