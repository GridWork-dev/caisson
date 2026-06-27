#!/usr/bin/env bun
/**
 * `stack-gate` — the standards-gate CLI (ADR-0021/0022). The ONLY registry ingress runs through
 * this. Exit non-zero on any "error" finding → fails the CI `standards-gate` job + blocks publish.
 * (Run via the CI job or `bun run gate`; it is NOT part of `bun run check`/turbo.)
 *
 * CI runs it TWICE (ci.yml): once pre-install (fs-only checks survive a broken install) and once
 * post-install — the post-install pass is where checkExternalAgpl + checkManifestAgreement (which
 * need node_modules) actually execute. A single pre-install run leaves those two skipped.
 *
 * This Bun script is the SPDX/license authority: AGPL boundary (workspace + external tree),
 * down-only direction, declarations, and manifest↔package.json agreement. Run ALONGSIDE in CI
 * (ADR-0022, all three layers): ESLint `no-restricted-imports` (fast static source signal) +
 * dependency-cruiser (the real module graph — dynamic import()/require + transitive provider-SDK
 * reachability) + the golden-file regression (ADR-0013 harness). A green run of all layers stamps
 * the registry-index provenance; the index itself is built by a CI-only writer (ADR-0021).
 */
import { findRoot, readWorkspace } from "./workspace";
import {
  checkAgplBoundary,
  checkExternalAgpl,
  checkDownOnly,
  checkDeclarations,
  checkManifestAgreement,
  type Finding,
} from "./checks";

async function main(): Promise<number> {
  const root = findRoot();
  const pkgs = readWorkspace(root);
  const findings: Finding[] = [
    ...checkAgplBoundary(pkgs),
    ...checkExternalAgpl(pkgs, root),
    ...checkDownOnly(pkgs),
    ...checkDeclarations(pkgs),
    ...(await checkManifestAgreement(pkgs)),
  ];

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  for (const f of findings) {
    const tag = f.severity === "error" ? "ERROR" : "warn ";
    process.stderr.write(`[${tag}] ${f.rule} · ${f.pkg}: ${f.message}\n`);
  }

  process.stderr.write(
    `\nstandards-gate: ${pkgs.length} packages · ${errors.length} error(s) · ${warns.length} warn(s)\n`,
  );
  process.stderr.write(
    `  alongside in CI (ADR-0022): ESLint provider-SDK signal + dependency-cruiser graph reach + golden (ADR-0013).\n`,
  );
  return errors.length > 0 ? 1 : 0;
}

process.exit(await main());
