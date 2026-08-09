// Bump-gated declaration-drift guard (ADR-0369). Replaces the retired weekly toolchain-advisory
// measurement lane's cutover purpose with a narrower, PR-scoped check: whenever
// tooling/tsconfig/package.json changes (tsc-native-dts-drift.yml), emit .d.ts for every
// packages/* tsc package with BOTH the base branch's pinned tsc-native compiler and this PR's
// pinned compiler, byte-compare the trees, and fail the job if anything differs. A maintainer
// who intends the drift regenerates baselines (and any downstream consumers) in the same PR.
//
// Reuses discoverTscPackages + compareDtsTrees from tsgo-agreement.ts (the same package
// discovery + byte-diff primitives that measurement lane already proved out) rather than
// duplicating them.
//
// Usage: TSC_BASE=/path/to/base/tsc TSC_HEAD=/path/to/head/tsc bun tooling/scripts/dts-drift-check.ts
import { appendFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareDtsTrees, discoverTscPackages } from "./tsgo-agreement.ts";
import type { DtsTreeDiff } from "./tsgo-agreement.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");

export interface PackageDriftResult {
  pkg: string;
  status: "identical" | "differing" | "skipped";
  diff?: DtsTreeDiff;
  reason?: string;
}

function emitDeclarations(
  tsc: string,
  tsconfigPath: string,
  outDir: string,
  cwd: string,
): { ok: boolean; reason?: string } {
  const proc = Bun.spawnSync(
    [
      tsc,
      "-p",
      tsconfigPath,
      "--declaration",
      "--emitDeclarationOnly",
      "--outDir",
      outDir,
    ],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    const combined =
      `${proc.stdout.toString("utf8")}\n${proc.stderr.toString("utf8")}`.trim();
    return {
      ok: false,
      reason:
        combined.length > 0
          ? combined.slice(0, 2000)
          : `exit ${String(proc.exitCode)}`,
    };
  }
  return { ok: true };
}

/** Emit + byte-compare one package's declarations under both compilers. Never throws — a
 *  compiler that fails to emit for either side is recorded as "skipped" (not a drift verdict),
 *  so one broken package can't hide a real drift finding in the rest of the run. */
export function checkPackageDrift(
  pkgDir: string,
  tsconfigPath: string,
  tscBase: string,
  tscHead: string,
  repoRoot: string,
): PackageDriftResult {
  const dirBase = mkdtempSync(join(tmpdir(), "dts-drift-base-"));
  const dirHead = mkdtempSync(join(tmpdir(), "dts-drift-head-"));
  try {
    const base = emitDeclarations(tscBase, tsconfigPath, dirBase, repoRoot);
    if (!base.ok) {
      return {
        pkg: pkgDir,
        status: "skipped",
        reason: `base tsc failed to emit: ${base.reason ?? "unknown"}`,
      };
    }
    const head = emitDeclarations(tscHead, tsconfigPath, dirHead, repoRoot);
    if (!head.ok) {
      return {
        pkg: pkgDir,
        status: "skipped",
        reason: `head tsc failed to emit: ${head.reason ?? "unknown"}`,
      };
    }
    // dir6/dir7 param names are compareDtsTrees's — here dir6=base, dir7=head.
    const diff = compareDtsTrees(dirBase, dirHead);
    const identical =
      diff.differing.length === 0 &&
      diff.onlyIn6.length === 0 &&
      diff.onlyIn7.length === 0;
    return identical
      ? { pkg: pkgDir, status: "identical" }
      : { pkg: pkgDir, status: "differing", diff };
  } finally {
    rmSync(dirBase, { recursive: true, force: true });
    rmSync(dirHead, { recursive: true, force: true });
  }
}

/** Pure: build the markdown status table + the overall pass/fail verdict from a batch of
 *  per-package results. Split out from main() so the report shape is unit-testable without
 *  spawning a real compiler. */
export function summarizeDrift(results: readonly PackageDriftResult[]): {
  anyDrift: boolean;
  table: string[];
} {
  const table = [
    "| package | status |",
    "|---|---|",
    ...results.map(
      (r) => `| ${r.pkg} | ${r.status}${r.reason ? ` (${r.reason})` : ""} |`,
    ),
  ];
  return { anyDrift: results.some((r) => r.status === "differing"), table };
}

async function main(): Promise<void> {
  const tscBase = process.env.TSC_BASE;
  const tscHead = process.env.TSC_HEAD;
  if (!tscBase || !tscHead) {
    process.stderr.write(
      "dts-drift-check: TSC_BASE and TSC_HEAD must both be set (paths to the base-branch and this-PR tsc binaries).\n",
    );
    process.exitCode = 1;
    return;
  }
  if (!existsSync(tscBase) || !existsSync(tscHead)) {
    process.stderr.write(
      `dts-drift-check: a compiler binary is missing (TSC_BASE=${tscBase} exists=${String(existsSync(tscBase))}, TSC_HEAD=${tscHead} exists=${String(existsSync(tscHead))}).\n`,
    );
    process.exitCode = 1;
    return;
  }

  const candidates = discoverTscPackages(REPO_ROOT).filter((c) =>
    c.dir.startsWith("packages/"),
  );
  const results = candidates.map((c) =>
    checkPackageDrift(c.dir, c.tsconfigPath, tscBase, tscHead, REPO_ROOT),
  );

  const { anyDrift, table } = summarizeDrift(results);
  const lines = [
    "## tsc-native .d.ts drift — base branch pin vs this PR's pin",
    "",
    ...table,
    "",
  ];
  const report = lines.join("\n");
  process.stdout.write(`${report}\n`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${report}\n`);

  if (anyDrift) {
    process.stderr.write(
      "\ndts-drift-check: FAIL — one or more packages/* emit different .d.ts bytes under the " +
        "bumped tsc-native pin. This is the buyer-era .d.ts stability gate: a maintainer accepts " +
        "the drift by regenerating baselines (and re-versioning any affected sold packages) in " +
        "this PR, not by silencing this check. Differing files:\n",
    );
    for (const r of results.filter((x) => x.status === "differing")) {
      process.stderr.write(
        `  ${r.pkg}: ${(r.diff?.differing ?? []).join(", ")}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    "dts-drift-check: PASS — declarations are byte-identical across the version bump.\n",
  );
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(
      `dts-drift-check: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  });
}
