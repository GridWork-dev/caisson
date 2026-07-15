// Measures whether the native Go TypeScript compiler (typescript@7.0.2, npm-published as a
// bin-only package — no JS compiler API) agrees with the repo's classic tsc (typescript@6.0.3,
// catalog) on --noEmit type-checking, plus the wall-clock delta between them. This is PURE
// MEASUREMENT feeding the PF2-1 cutover decision — it never gates anything and always exits 0.
//
// Two legs:
//   1. Agreement — per discovered workspace package, run repo tsc and native tsc with the same
//      --noEmit args; compare exit codes + diagnostics; record wall-clock ms for each.
//   2. --dts-diff-kernel — packages/kernel ONLY: emit .d.ts with both compilers into separate temp
//      outDirs and byte-compare the trees. Byte-equivalence is the cutover gate for SOLD packages
//      (a buyer's .d.ts must not silently change shape under a compiler swap).
//
// Usage: bun tooling/scripts/tsgo-agreement.ts [--packages a,b,c] [--dts-diff-kernel]
//   NATIVE_TSC=/path/to/native/tsc bun tooling/scripts/tsgo-agreement.ts --dts-diff-kernel
//
// Never crashes on a bad package or a missing/misbehaving native binary — every compiler
// invocation is caught and recorded as a data point ("native failed"), not a thrown error, so one
// package's compiler crash never takes down the whole run.
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..");

// ============================================================================================
// Pure: workspace package discovery
// ============================================================================================

interface PackageCandidate {
  /** Repo-relative dir, e.g. "packages/kernel". Used as the display key + --packages filter. */
  dir: string;
  tsconfigPath: string;
}

/** Root package.json "workspaces" can be a bare array or `{ packages: [...] }` (this repo uses
 *  the latter, with a sibling `catalog` key) — support both rather than assume the shape. */
export function readWorkspaceGlobs(repoRoot: string): string[] {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  ) as { workspaces?: string[] | { packages?: string[] } };
  if (!raw.workspaces) return [];
  return Array.isArray(raw.workspaces)
    ? raw.workspaces
    : (raw.workspaces.packages ?? []);
}

/** Expand workspace globs to actual directories. Globs here are always directory-shaped
 *  ("packages/*", "registry" — never "**"), so a plain Bun.Glob scan + isDirectory filter is
 *  enough; no need for a general-purpose glob-to-package resolver. */
export function expandWorkspaceDirs(
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

const TSC_USAGE_RE = /\btsc\b/;

/** A package is in scope when it has a tsconfig.json AND its build/check script actually invokes
 *  tsc (skips `next build` apps and non-TS packages like tooling/eslint-config). */
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
      const usesTsc =
        TSC_USAGE_RE.test(scripts.build ?? "") ||
        TSC_USAGE_RE.test(scripts.check ?? "");
      if (usesTsc) out.push({ dir, tsconfigPath });
    } catch {
      // Malformed package.json for one package must never abort discovery for the rest.
      process.stderr.write(
        `tsgo-agreement: ${dir}/package.json unreadable — skipping.\n`,
      );
    }
  }
  return out;
}

// ============================================================================================
// Pure: argv
// ============================================================================================

export interface Argv {
  packages: string[] | null;
  dtsDiffKernel: boolean;
}

export function parseArgv(argv: readonly string[]): Argv {
  let packages: string[] | null = null;
  let dtsDiffKernel = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--dts-diff-kernel") {
      dtsDiffKernel = true;
    } else if (arg === "--packages") {
      const val = argv[i + 1];
      if (val) {
        packages = val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
      }
    } else if (arg.startsWith("--packages=")) {
      packages = arg
        .slice("--packages=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { packages, dtsDiffKernel };
}

// ============================================================================================
// Impure: running a compiler binary + pure diagnostic parsing
// ============================================================================================

export interface CompilerResult {
  /** false only when the binary itself could not be spawned (missing/not executable). A tsc run
   *  that exits nonzero with real diagnostics is still `available: true` — that's a measurement,
   *  not a crash. */
  available: boolean;
  exitCode: number | null;
  ms: number;
  diagnostics: string[];
  crashReason?: string;
}

const DIAGNOSTIC_RE = /error TS\d+/;

function runCompiler(
  bin: string,
  args: readonly string[],
  cwd: string,
): CompilerResult {
  const start = performance.now();
  try {
    const proc = Bun.spawnSync([bin, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const ms = performance.now() - start;
    const combined = `${proc.stdout.toString("utf8")}\n${proc.stderr.toString("utf8")}`;
    const diagnostics = combined
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => DIAGNOSTIC_RE.test(l));
    return { available: true, exitCode: proc.exitCode, ms, diagnostics };
  } catch (err) {
    // Binary missing, not executable, or the OS refused to spawn it — record and keep going.
    return {
      available: false,
      exitCode: null,
      ms: performance.now() - start,
      diagnostics: [],
      crashReason: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Symmetric-difference of two diagnostic line sets, `-` = tsc6-only / `+` = tsc7-only, capped at
 *  5 total — enough to see the shape of a disagreement without dumping a full diff. */
export function diffDiagnostics(
  a: readonly string[],
  b: readonly string[],
): string[] {
  const setA = new Set(a);
  const setB = new Set(b);
  const diffs: string[] = [];
  for (const d of a) if (!setB.has(d)) diffs.push(`- ${d}`);
  for (const d of b) if (!setA.has(d)) diffs.push(`+ ${d}`);
  return diffs.slice(0, 5);
}

function formatCompilerCell(r: CompilerResult): string {
  if (!r.available) return "native failed";
  return r.exitCode === 0
    ? "0 (clean)"
    : `${String(r.exitCode)} (${String(r.diagnostics.length)} err)`;
}

interface PackageAgreement {
  pkg: string;
  tsc6: CompilerResult;
  tsc7: CompilerResult | null;
  diffs: string[];
}

function agreementLabel(row: PackageAgreement): string {
  if (row.tsc7 === null) return "n/a";
  if (!row.tsc7.available) return "native failed";
  const agree =
    row.tsc6.exitCode === row.tsc7.exitCode && row.diffs.length === 0;
  return agree ? "yes" : "no";
}

function formatRow(row: PackageAgreement): string {
  const tsc7Cell = row.tsc7 ? formatCompilerCell(row.tsc7) : "not configured";
  const tsc7Ms = row.tsc7 ? row.tsc7.ms.toFixed(0) : "-";
  return `| ${row.pkg} | ${formatCompilerCell(row.tsc6)} | ${tsc7Cell} | ${agreementLabel(row)} | ${row.tsc6.ms.toFixed(0)} | ${tsc7Ms} |`;
}

// ============================================================================================
// Impure: the .d.ts byte-equivalence leg (packages/kernel only)
// ============================================================================================

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

export function compareDtsTrees(dir6: string, dir7: string): DtsTreeDiff {
  const files6 = new Set(listDtsFiles(dir6));
  const files7 = new Set(listDtsFiles(dir7));
  const identical: string[] = [];
  const differing: string[] = [];
  for (const f of files6) {
    if (!files7.has(f)) continue;
    const bufA = readFileSync(join(dir6, f));
    const bufB = readFileSync(join(dir7, f));
    (bufA.equals(bufB) ? identical : differing).push(f);
  }
  return {
    identical: identical.sort(),
    differing: differing.sort(),
    onlyIn6: [...files6].filter((f) => !files7.has(f)).sort(),
    onlyIn7: [...files7].filter((f) => !files6.has(f)).sort(),
  };
}

function runDtsDiffKernel(
  repoRoot: string,
  repoTsc: string,
  nativeTsc: string | null,
): string[] {
  const lines = [
    "",
    "## .d.ts byte-equivalence — packages/kernel (cutover gate)",
    "",
  ];
  const kernelTsconfig = join(repoRoot, "packages", "kernel", "tsconfig.json");
  if (!existsSync(kernelTsconfig)) {
    lines.push("_packages/kernel/tsconfig.json not found — skipping._");
    return lines;
  }
  if (!nativeTsc) {
    lines.push(
      "_NATIVE_TSC not set — skipping (needs the native compiler binary)._",
    );
    return lines;
  }

  const dir6 = mkdtempSync(join(tmpdir(), "tsgo-dts-6-"));
  const dir7 = mkdtempSync(join(tmpdir(), "tsgo-dts-7-"));
  try {
    const emitArgs = [
      "-p",
      kernelTsconfig,
      "--declaration",
      "--emitDeclarationOnly",
    ];
    const r6 = runCompiler(repoTsc, [...emitArgs, "--outDir", dir6], repoRoot);
    const r7 = runCompiler(
      nativeTsc,
      [...emitArgs, "--outDir", dir7],
      repoRoot,
    );

    if (!r6.available || r6.exitCode !== 0) {
      lines.push(
        `_repo tsc failed to emit declarations (exit ${String(r6.exitCode)}${r6.crashReason ? `: ${r6.crashReason}` : ""}) — skipping byte comparison._`,
      );
      return lines;
    }
    if (!r7.available || r7.exitCode !== 0) {
      lines.push(
        `_native tsc failed to emit declarations (exit ${String(r7.exitCode)}${r7.crashReason ? `: ${r7.crashReason}` : ""}) — skipping byte comparison._`,
      );
      return lines;
    }

    const diff = compareDtsTrees(dir6, dir7);
    const byteEquivalent =
      diff.differing.length === 0 &&
      diff.onlyIn6.length === 0 &&
      diff.onlyIn7.length === 0;
    lines.push(`- identical: ${String(diff.identical.length)} file(s)`);
    lines.push(
      `- differing: ${String(diff.differing.length)} file(s)${diff.differing.length ? ` — ${diff.differing.join(", ")}` : ""}`,
    );
    if (diff.onlyIn6.length > 0) {
      lines.push(`- only in repo tsc output: ${diff.onlyIn6.join(", ")}`);
    }
    if (diff.onlyIn7.length > 0) {
      lines.push(`- only in native tsc output: ${diff.onlyIn7.join(", ")}`);
    }
    lines.push(`- byte-equivalent: ${byteEquivalent ? "YES" : "NO"}`);
  } finally {
    rmSync(dir6, { recursive: true, force: true });
    rmSync(dir7, { recursive: true, force: true });
  }
  return lines;
}

// ============================================================================================
// main
// ============================================================================================

async function main(): Promise<void> {
  const { packages: filterPackages, dtsDiffKernel } = parseArgv(
    process.argv.slice(2),
  );

  const repoTsc = join(REPO_ROOT, "node_modules", ".bin", "tsc");
  const nativeTsc = process.env.NATIVE_TSC ?? null;

  if (!existsSync(repoTsc)) {
    process.stderr.write(
      `tsgo-agreement: repo tsc not found at ${repoTsc} — run bun install first. Nothing to measure.\n`,
    );
    return;
  }

  let candidates = discoverTscPackages(REPO_ROOT);
  if (filterPackages) {
    const want = new Set(filterPackages);
    candidates = candidates.filter((c) => want.has(c.dir));
    for (const w of want) {
      if (!candidates.some((c) => c.dir === w)) {
        process.stderr.write(
          `tsgo-agreement: --packages requested "${w}" but it has no tsconfig.json + tsc build/check script — skipping.\n`,
        );
      }
    }
  }

  const rows: PackageAgreement[] = [];
  for (const candidate of candidates) {
    try {
      const tsc6 = runCompiler(
        repoTsc,
        ["-p", candidate.tsconfigPath, "--noEmit"],
        REPO_ROOT,
      );
      const tsc7 = nativeTsc
        ? runCompiler(
            nativeTsc,
            ["-p", candidate.tsconfigPath, "--noEmit"],
            REPO_ROOT,
          )
        : null;
      const diffs =
        tsc7 && tsc7.available
          ? diffDiagnostics(tsc6.diagnostics, tsc7.diagnostics)
          : [];
      rows.push({ pkg: candidate.dir, tsc6, tsc7, diffs });
    } catch (err) {
      // Belt-and-braces: runCompiler already catches spawn failures, but a tsconfig with a
      // shape our path-building doesn't expect must skip its package, not the whole run.
      process.stderr.write(
        `tsgo-agreement: ${candidate.dir} — unexpected error, skipping: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  const lines: string[] = [
    "## tsgo agreement — repo tsc (6.0.3) vs native tsc (7.0.2)",
    "",
  ];
  if (!nativeTsc) {
    lines.push(
      "_NATIVE_TSC not set — measuring repo tsc only; native columns show `not configured`._",
      "",
    );
  }
  lines.push(
    "| package | tsc6 | tsc7 | agree? | tsc6 ms | tsc7 ms |",
    "|---|---|---|---|---|---|",
    ...rows.map(formatRow),
    "",
  );

  const disagreements = rows.filter((r) => r.diffs.length > 0);
  if (disagreements.length > 0) {
    lines.push("### First differing diagnostics (up to 5 per package)", "");
    for (const row of disagreements) {
      lines.push(`**${row.pkg}**`, "```", ...row.diffs, "```", "");
    }
  }

  if (dtsDiffKernel) {
    lines.push(...runDtsDiffKernel(REPO_ROOT, repoTsc, nativeTsc));
  }

  const report = lines.join("\n");
  process.stdout.write(`${report}\n`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${report}\n`);
}

if (import.meta.main) {
  // Advisory lane: the data is the deliverable, never a gate. Any unexpected throw is logged,
  // never propagated — exit 0 unconditionally.
  main()
    .catch((err: unknown) => {
      process.stderr.write(
        `tsgo-agreement: unexpected error (advisory lane, non-blocking): ${err instanceof Error ? err.message : String(err)}\n`,
      );
    })
    .finally(() => {
      process.exit(0);
    });
}
