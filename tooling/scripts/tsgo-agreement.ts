// Shared package-discovery and declaration-tree comparison primitives for the bump-gated native
// TypeScript declaration drift check. The retired compiler-agreement CLI no longer lives here.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface PackageCandidate {
  /** Repo-relative dir, e.g. "packages/kernel". */
  dir: string;
  tsconfigPath: string;
}

function readWorkspaceGlobs(repoRoot: string): string[] {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  ) as { workspaces?: string[] | { packages?: string[] } };
  if (!raw.workspaces) return [];
  return Array.isArray(raw.workspaces)
    ? raw.workspaces
    : (raw.workspaces.packages ?? []);
}

function expandWorkspaceDirs(
  globs: readonly string[],
  repoRoot: string,
): string[] {
  const dirs = new Set<string>();
  for (const pattern of globs) {
    if (pattern.includes("*")) {
      const glob = new Bun.Glob(pattern);
      for (const match of glob.scanSync({ cwd: repoRoot, onlyFiles: false })) {
        if (statSync(join(repoRoot, match)).isDirectory()) dirs.add(match);
      }
    } else if (existsSync(join(repoRoot, pattern))) {
      dirs.add(pattern);
    }
  }
  return [...dirs].sort();
}

const TSC_USAGE_RE = /\btscn?\b/;

/** Discover workspaces with a tsconfig and a build/check script that invokes tsc or tscn. */
export function discoverTscPackages(repoRoot: string): PackageCandidate[] {
  const dirs = expandWorkspaceDirs(readWorkspaceGlobs(repoRoot), repoRoot);
  const out: PackageCandidate[] = [];
  for (const dir of dirs) {
    const tsconfigPath = join(repoRoot, dir, "tsconfig.json");
    const pkgJsonPath = join(repoRoot, dir, "package.json");
    if (!existsSync(tsconfigPath) || !existsSync(pkgJsonPath)) continue;
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
        scripts?: Record<string, string>;
      };
      const scripts = pkgJson.scripts ?? {};
      if (
        TSC_USAGE_RE.test(scripts.build ?? "") ||
        TSC_USAGE_RE.test(scripts.check ?? "")
      ) {
        out.push({ dir, tsconfigPath });
      }
    } catch {
      process.stderr.write(
        `tsgo-agreement: ${dir}/package.json unreadable — skipping.\n`,
      );
    }
  }
  return out;
}

function listDtsFiles(dir: string): string[] {
  const glob = new Bun.Glob("**/*.d.ts");
  return [...glob.scanSync({ cwd: dir, onlyFiles: true })].sort();
}

export interface DtsTreeDiff {
  identical: string[];
  differing: string[];
  onlyIn6: string[];
  onlyIn7: string[];
}

/** Compare two declaration output trees by relative path and exact bytes. */
export function compareDtsTrees(dir6: string, dir7: string): DtsTreeDiff {
  const files6 = new Set(listDtsFiles(dir6));
  const files7 = new Set(listDtsFiles(dir7));
  const identical: string[] = [];
  const differing: string[] = [];
  for (const file of files6) {
    if (!files7.has(file)) continue;
    const left = readFileSync(join(dir6, file));
    const right = readFileSync(join(dir7, file));
    (left.equals(right) ? identical : differing).push(file);
  }
  return {
    identical: identical.sort(),
    differing: differing.sort(),
    onlyIn6: [...files6].filter((file) => !files7.has(file)).sort(),
    onlyIn7: [...files7].filter((file) => !files6.has(file)).sort(),
  };
}
