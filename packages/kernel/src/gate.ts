// The standards gate (ADR-0016 / ADR-0004). The single enforcement of the ADR-0002 "one
// standard" invariant: every active package extends @caisson/tsconfig + @caisson/eslint-config +
// @caisson/testing, declares build/lint/test, and is @caisson/-scoped. It is also the sole registry
// ingress — no `registry/` module may land without a golden fixture + a gate stamp.
//
// Run from the repo root: `bun run gate` (CI job + a fast slice in the pre-commit hook).
// Scaffold packages (no real code, no tsconfig) are skipped until they grow code, at which point
// they must conform — a package with `.ts` files but no tsconfig is a hard violation, not a skip.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../..");

const CONFIG_PACKAGES = new Set([
  "@caisson/tsconfig",
  "@caisson/eslint-config",
]);
const REQUIRED_SCRIPTS = ["build", "lint", "test"] as const;

export interface Violation {
  pkg: string;
  rule: string;
  detail: string;
}

interface PkgJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function listMembers(): string[] {
  const root = readJson(join(ROOT, "package.json"));
  const globs = Array.isArray(root.workspaces)
    ? (root.workspaces as string[])
    : [];
  const members: string[] = [];
  for (const glob of globs) {
    if (glob.endsWith("/*")) {
      const base = glob.slice(0, -2);
      const dir = join(ROOT, base);
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) members.push(`${base}/${entry.name}`);
      }
    } else {
      members.push(glob);
    }
  }
  return members.filter((rel) => existsSync(join(ROOT, rel, "package.json")));
}

function hasRealCode(absDir: string): boolean {
  const src = join(absDir, "src");
  if (!existsSync(src)) return false;
  const walk = (dir: string): boolean =>
    readdirSync(dir, { withFileTypes: true }).some((e) => {
      if (e.isDirectory()) return walk(join(dir, e.name));
      return e.name.endsWith(".ts") || e.name.endsWith(".tsx");
    });
  return walk(src);
}

function hasEslintConfig(absDir: string): boolean {
  return ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs"].some(
    (f) => existsSync(join(absDir, f)),
  );
}

function extendsBaseTsconfig(absDir: string): boolean {
  const path = join(absDir, "tsconfig.json");
  if (!existsSync(path)) return false;
  const ext = (readJson(path) as { extends?: unknown }).extends;
  const target = "@caisson/tsconfig/base.json";
  if (typeof ext === "string") return ext === target;
  if (Array.isArray(ext)) return ext.includes(target);
  return false;
}

function checkPackage(rel: string): {
  violations: Violation[];
  status: "ok" | "skip";
} {
  const absDir = join(ROOT, rel);
  const pkg = readJson(join(absDir, "package.json")) as PkgJson;
  const name = pkg.name ?? rel;
  const isTooling = rel.startsWith("tooling/");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const v: Violation[] = [];

  // Pure config packages (tsconfig/eslint-config) are exempt from the code rules.
  if (name !== undefined && CONFIG_PACKAGES.has(name)) {
    if (!name.startsWith("@caisson/")) {
      v.push({
        pkg: name,
        rule: "naming",
        detail: "config package must be @caisson/-scoped",
      });
    }
    return { violations: v, status: "ok" };
  }

  const code = hasRealCode(absDir);
  const ts = existsSync(join(absDir, "tsconfig.json"));
  const active = code || ts;
  if (!active) return { violations: v, status: "skip" };

  if (code && !ts) {
    v.push({
      pkg: name,
      rule: "tsconfig",
      detail: "has .ts source but no tsconfig.json",
    });
  }
  if (!name.startsWith("@caisson/")) {
    v.push({
      pkg: name,
      rule: "naming",
      detail: `package name "${name}" is not @caisson/-scoped`,
    });
  }
  if (!extendsBaseTsconfig(absDir)) {
    v.push({
      pkg: name,
      rule: "tsconfig",
      detail: 'must extend "@caisson/tsconfig/base.json"',
    });
  }
  if (!hasEslintConfig(absDir)) {
    v.push({ pkg: name, rule: "eslint", detail: "missing eslint.config.js" });
  }
  for (const s of REQUIRED_SCRIPTS) {
    if (pkg.scripts?.[s] === undefined) {
      v.push({ pkg: name, rule: "scripts", detail: `missing "${s}" script` });
    }
  }
  for (const required of ["@caisson/tsconfig", "@caisson/eslint-config"]) {
    if (deps[required] === undefined) {
      v.push({ pkg: name, rule: "deps", detail: `must depend on ${required}` });
    }
  }
  // Every non-tooling code package extends the shared test harness.
  if (!isTooling && deps["@caisson/testing"] === undefined) {
    v.push({
      pkg: name,
      rule: "deps",
      detail: "must depend on @caisson/testing",
    });
  }
  return { violations: v, status: "ok" };
}

// ADR-0004: the registry-publish path IS this gate. A module dir may only land with a golden
// fixture + a gate stamp. For P0 the registry holds no modules, so this asserts the mechanism.
function checkRegistry(): Violation[] {
  const dir = join(ROOT, "registry");
  if (!existsSync(dir)) return [];
  const v: Violation[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleDir = join(dir, entry.name);
    if (!existsSync(join(moduleDir, "module.json"))) continue; // not a module yet
    const stamped = existsSync(join(moduleDir, ".gate-stamp"));
    const goldened = existsSync(join(moduleDir, "__golden__"));
    if (!stamped || !goldened) {
      v.push({
        pkg: `registry/${entry.name}`,
        rule: "registry",
        detail:
          "module must carry a __golden__ fixture and a .gate-stamp (ADR-0004)",
      });
    }
  }
  return v;
}

export function runGate(): {
  violations: Violation[];
  checked: string[];
  skipped: string[];
} {
  const violations: Violation[] = [];
  const checked: string[] = [];
  const skipped: string[] = [];
  for (const rel of listMembers()) {
    const { violations: v, status } = checkPackage(rel);
    if (status === "skip") skipped.push(rel);
    else checked.push(rel);
    violations.push(...v);
  }
  violations.push(...checkRegistry());
  return { violations, checked, skipped };
}

if (import.meta.main) {
  const { violations, checked, skipped } = runGate();
  const log = console.log.bind(console);
  log(
    `standards-gate: ${checked.length} checked, ${skipped.length} scaffold-skipped`,
  );
  if (skipped.length > 0) log(`  skipped (no code yet): ${skipped.join(", ")}`);
  if (violations.length === 0) {
    log("✓ all packages conform to the standard (ADR-0002)");
    process.exit(0);
  }
  log(`\n✗ ${violations.length} violation(s):`);
  for (const { pkg, rule, detail } of violations)
    log(`  [${rule}] ${pkg}: ${detail}`);
  process.exit(1);
}
