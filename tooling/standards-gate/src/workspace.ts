/**
 * Workspace reader — expands the root package.json `workspaces` globs into the set of packages,
 * each with its package.json + optional manifest path. No deps beyond node:fs.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

export interface Pkg {
  dir: string;
  name: string;
  version: string | null;
  license: string | null;
  /** workspace deps (entries whose name starts with @caisson-sh/). */
  workspaceDeps: string[];
  manifestPath: string | null;
  /** true once the package ships real code (src/ beyond .gitkeep, OR an entry/main/exports). */
  hasCode: boolean;
  /** package.json `private: true` — never published to npm. */
  private: boolean;
}

/** `workspaces` is either the legacy bare array or the bun-catalog object form
 *  (`{ packages: [...], catalog: {...} }`, ADR-program row #4) — read the package globs from
 *  whichever shape is present. */
function workspaceGlobs(workspaces: unknown): string[] {
  if (Array.isArray(workspaces)) return workspaces as string[];
  const packages = (workspaces as { packages?: unknown } | undefined)?.packages;
  return Array.isArray(packages) ? (packages as string[]) : [];
}

/** Repo root = the dir whose package.json declares `workspaces`. */
export function findRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      const json = JSON.parse(readFileSync(pj, "utf8"));
      const ws = json.workspaces;
      if (Array.isArray(ws) || Array.isArray(ws?.packages)) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error("repo root (package.json with `workspaces`) not found");
    dir = parent;
  }
}

function expandGlob(root: string, pattern: string): string[] {
  // Supports "<dir>/*" and exact "<dir>" — the only forms this monorepo uses.
  if (pattern.endsWith("/*")) {
    const base = join(root, pattern.slice(0, -2));
    if (!existsSync(base)) return [];
    return readdirSync(base)
      .map((d) => join(base, d))
      .filter(
        (d) => statSync(d).isDirectory() && existsSync(join(d, "package.json")),
      );
  }
  const exact = join(root, pattern);
  return existsSync(join(exact, "package.json")) ? [exact] : [];
}

/** Ships code if src/ holds more than .gitkeep, OR package.json declares an entry/main/exports. */
function shipsCode(dir: string, pj: Record<string, unknown>): boolean {
  const src = join(dir, "src");
  if (existsSync(src) && readdirSync(src).some((f) => f !== ".gitkeep"))
    return true;
  return Boolean(pj.main || pj.module || pj.exports);
}

export function readWorkspace(root = findRoot()): Pkg[] {
  const rootPj = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const dirs = workspaceGlobs(rootPj.workspaces).flatMap((p) =>
    expandGlob(root, p),
  );
  const out: Pkg[] = [];
  for (const dir of dirs) {
    const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const deps = Object.keys({
      ...pj.dependencies,
      ...pj.peerDependencies,
      ...pj.optionalDependencies,
    });
    const manifest = join(dir, "manifest.ts");
    out.push({
      dir,
      name: pj.name,
      version: typeof pj.version === "string" ? pj.version : null,
      license: typeof pj.license === "string" ? pj.license : null,
      workspaceDeps: deps.filter((d) => d.startsWith("@caisson-sh/")),
      manifestPath: existsSync(manifest) ? manifest : null,
      hasCode: shipsCode(dir, pj),
      private: pj.private === true,
    });
  }
  return out;
}

/** AGPL per SPDX. Handles `AGPL-3.0-*`, `Affero`, and the AGPL term inside an AND/OR expression. */
export function isAgpl(license: string | null): boolean {
  if (!license) return false;
  return /\bAGPL\b/i.test(license) || /affero/i.test(license);
}
