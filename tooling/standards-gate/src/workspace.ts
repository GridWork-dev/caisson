/**
 * Workspace reader — expands the root package.json `workspaces` globs into the set of packages,
 * each with its package.json + optional manifest path. No deps beyond node:fs.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

export interface Pkg {
  dir: string;
  name: string;
  license: string | null;
  /** workspace deps only (entries whose name starts with @stack/). */
  workspaceDeps: string[];
  hasManifest: boolean;
  /** true once src/ holds more than the .gitkeep placeholder (i.e. real code exists). */
  hasCode: boolean;
}

/** Repo root = the dir whose package.json declares `workspaces`. */
export function findRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      const json = JSON.parse(readFileSync(pj, "utf8"));
      if (Array.isArray(json.workspaces)) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("repo root (package.json with `workspaces`) not found");
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
      .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "package.json")));
  }
  const exact = join(root, pattern);
  return existsSync(join(exact, "package.json")) ? [exact] : [];
}

function srcHasCode(dir: string): boolean {
  const src = join(dir, "src");
  if (!existsSync(src)) return false;
  return readdirSync(src).some((f) => f !== ".gitkeep");
}

export function readWorkspace(root = findRoot()): Pkg[] {
  const rootPj = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const dirs = (rootPj.workspaces as string[]).flatMap((p) => expandGlob(root, p));
  const out: Pkg[] = [];
  for (const dir of dirs) {
    const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const deps = { ...pj.dependencies, ...pj.peerDependencies };
    out.push({
      dir,
      name: pj.name,
      license: typeof pj.license === "string" ? pj.license : null,
      workspaceDeps: Object.keys(deps ?? {}).filter((d) => d.startsWith("@stack/")),
      hasManifest: existsSync(join(dir, "manifest.ts")),
      hasCode: srcHasCode(dir),
    });
  }
  return out;
}

export const isAgpl = (license: string | null): boolean => !!license && /AGPL/i.test(license);
