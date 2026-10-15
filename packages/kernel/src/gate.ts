// The standards gate (ADR-0016 / ADR-0004). The single enforcement of the ADR-0002 "one
// standard" invariant: every active package extends @caisson-sh/tsconfig + @caisson-sh/testing,
// declares build/lint/test, and is @caisson-sh/-scoped. It is also the sole registry
// ingress — no `registry/` module may land without a golden fixture + a gate stamp.
//
// Run from the repo root: `bun run gate` (CI job + a fast slice in the pre-commit hook).
// Scaffold packages (no real code, no tsconfig) are skipped until they grow code, at which point
// they must conform — a package with `.ts` files but no tsconfig is a hard violation, not a skip.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../..");

const CONFIG_PACKAGES = new Set([
  "@caisson-sh/tsconfig",
  "@caisson-sh/lint-policy",
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

/** `workspaces` is either the legacy bare array or the bun-catalog object form
 *  (`{ packages: [...], catalog: {...} }`, ADR-program row #4) — read the package globs from
 *  whichever shape is present. */
function workspaceGlobs(workspaces: unknown): string[] {
  if (Array.isArray(workspaces)) return workspaces as string[];
  const packages = (workspaces as { packages?: unknown } | undefined)?.packages;
  return Array.isArray(packages) ? (packages as string[]) : [];
}

function listMembers(): string[] {
  const root = readJson(join(ROOT, "package.json"));
  const globs = workspaceGlobs(root.workspaces);
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

function extendsBaseTsconfig(absDir: string): boolean {
  const path = join(absDir, "tsconfig.json");
  if (!existsSync(path)) return false;
  const ext = (readJson(path) as { extends?: unknown }).extends;
  const target = "@caisson-sh/tsconfig/base.json";
  if (typeof ext === "string") return ext === target;
  if (Array.isArray(ext)) return ext.includes(target);
  return false;
}

/** Published unscoped on purpose: `npm create caisson` resolves the bare name `create-caisson`. */
const UNSCOPED_ALIASES = new Set(["create-caisson"]);

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

  // Pure config/policy packages (tsconfig, lint-policy) are exempt from the code rules.
  if (name !== undefined && CONFIG_PACKAGES.has(name)) {
    if (!name.startsWith("@caisson-sh/")) {
      v.push({
        pkg: name,
        rule: "naming",
        detail: "config package must be @caisson-sh/-scoped",
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
  if (!name.startsWith("@caisson-sh/") && !UNSCOPED_ALIASES.has(name)) {
    v.push({
      pkg: name,
      rule: "naming",
      detail: `package name "${name}" is not @caisson-sh/-scoped`,
    });
  }
  if (!extendsBaseTsconfig(absDir)) {
    v.push({
      pkg: name,
      rule: "tsconfig",
      detail: 'must extend "@caisson-sh/tsconfig/base.json"',
    });
  }
  for (const s of REQUIRED_SCRIPTS) {
    if (pkg.scripts?.[s] === undefined) {
      v.push({ pkg: name, rule: "scripts", detail: `missing "${s}" script` });
    }
  }
  // Lint is no longer a per-package concern: ADR-0409 replaced the 72 per-package eslint configs
  // (and the shared config package every one of them depended on) with a single root
  // .oxlintrc.json whose globs anchor to the repo root. There is nothing left for a package to
  // declare or extend, so the old "has an eslint.config.js" and "depends on the lint config"
  // rules are gone rather than repointed — a per-package lint config would now be the violation.
  for (const required of ["@caisson-sh/tsconfig"]) {
    if (deps[required] === undefined) {
      v.push({ pkg: name, rule: "deps", detail: `must depend on ${required}` });
    }
  }
  // Every non-tooling code package extends the shared test harness.
  if (!isTooling && deps["@caisson-sh/testing"] === undefined) {
    v.push({
      pkg: name,
      rule: "deps",
      detail: "must depend on @caisson-sh/testing",
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
