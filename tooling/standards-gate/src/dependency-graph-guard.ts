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

// Non-vacuity floors, about 10% under the measured tree (2064 modules, 1416 TypeScript, 5871
// dependencies after the site dropped its commerce surface). They catch a scan that silently
// covered a fraction of the tree; re-measure and lower them when a deliberate deletion lands.
const DEFAULT_OPTIONS: DependencyGraphGuardOptions = {
  minimumModules: 1_850,
  minimumTypeScriptModules: 1_250,
  minimumDependencies: 5_250,
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

/**
 * Fail on any `severity: "error"` rule violation — the base↔edition down-only direction, the
 * open↔commercial no-depend-up boundary, cycles.
 *
 * This is NOT redundant with the process exit code. `--output-type json` reports through
 * dependency-cruiser's json reporter, which hardcodes `exitCode: 0` (the default `err` reporter is
 * the one that returns `summary.error`), so `execFileSync` cannot throw on a violation. Switching
 * the CI command to the JSON output silently disarmed the ADR-0022 gate; reading `summary.error`
 * out of the payload we already parsed restores it without a second cruise.
 *
 * Absence fails closed: a missing or malformed `summary` means we did not measure violations, which
 * must never read the same as measuring zero.
 */
export function assertNoDependencyViolations(input: unknown): void {
  if (typeof input !== "object" || input === null) {
    throw new Error("dependency-cruiser output must be an object");
  }
  const summary = (input as { summary?: unknown }).summary;
  if (typeof summary !== "object" || summary === null) {
    throw new Error(
      "dependency-cruiser output has no summary; refusing to treat unmeasured violations as zero",
    );
  }
  const errors = (summary as { error?: unknown }).error;
  if (typeof errors !== "number" || !Number.isInteger(errors) || errors < 0) {
    throw new Error(
      "dependency-cruiser summary.error is missing or not a count; refusing to treat unmeasured violations as zero",
    );
  }
  if (errors > 0) {
    const violations = (summary as { violations?: unknown }).violations;
    const detail = Array.isArray(violations)
      ? violations
          .filter(
            (v): v is { from: string; to: string; rule: { name: string } } =>
              typeof v === "object" &&
              v !== null &&
              (v as { rule?: { severity?: unknown } }).rule?.severity ===
                "error",
          )
          .slice(0, 10)
          .map((v) => `  ${v.rule.name}: ${v.from} -> ${v.to}`)
          .join("\n")
      : "";
    throw new Error(
      `dependency-cruiser found ${String(errors)} error-severity violation(s)${detail ? `:\n${detail}` : ""}`,
    );
  }
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
  const graph = JSON.parse(graphOutput) as unknown;
  const coverage = assertDependencyGraphCoverage(graph);
  assertNoDependencyViolations(graph);
  process.stdout.write(
    `dependency graph coverage: TypeScript ${info.typescriptVersion}; ${coverage.modules} modules; ${coverage.typescriptModules} TypeScript modules; ${coverage.dependencies} dependencies; sentinels present; 0 error-severity violations\n`,
  );
}

if (import.meta.main) {
  runDependencyGraphGuard();
}
