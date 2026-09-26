#!/usr/bin/env bun
/**
 * `caisson-gate` — the standards-gate CLI (ADR-0021/0022). Exit non-zero on any "error" finding →
 * fails the CI `standards-gate` job. (Run via the CI job or directly; it is NOT part of
 * `bun run check`/turbo.)
 *
 * CI runs it post-install — that is where checkExternalAgpl + checkManifestAgreement (which need
 * node_modules) actually execute; a pre-install run leaves those two skipped with a warn.
 *
 * This Bun script is the SPDX/license authority: AGPL boundary (workspace + external tree),
 * declarations, the Apache-2.0 + LICENSE rule for every published package, manifest↔package.json agreement, and hand-written-migration-RLS-vs-generator
 * equivalence (ADR-0210/0005). Run ALONGSIDE in CI (ADR-0022, all three layers): oxlint
 * `no-restricted-imports` (fast static source signal) + dependency-cruiser (the real module graph —
 * dynamic import()/require + transitive provider-SDK reachability) + the golden-file regression
 * (ADR-0013 harness).
 */
import { findRoot, readWorkspace } from "./workspace";
import {
  checkAgplBoundary,
  checkExternalAgpl,
  checkDeclarations,
  checkOpenLicense,
  checkNoSalesCopy,
  checkManifestAgreement,
  checkCopyPaste,
  checkRlsEquivalence,
  checkShippedProse,
  checkChangesetProse,
  type Finding,
} from "./checks";

async function main(): Promise<number> {
  const root = findRoot();
  const pkgs = readWorkspace(root);
  const findings: Finding[] = [
    ...checkAgplBoundary(pkgs),
    ...checkExternalAgpl(pkgs, root),
    ...checkDeclarations(pkgs),
    ...checkOpenLicense(pkgs), // every published package: Apache-2.0 + a LICENSE naming the holder
    ...checkNoSalesCopy(pkgs), // no "commercial" tier or $ price in a published description/README
    ...(await checkManifestAgreement(pkgs)),
    ...checkCopyPaste(root), // ADR-0101 gate #4: cross-package copy-paste
    ...(await checkRlsEquivalence(pkgs, root)), // ADR-0210/0005: hand-written RLS vs the generator
    ...checkShippedProse(pkgs, root), // shipped-prose gate: no internal-only vocabulary in published source
    ...checkChangesetProse(root), // changeset-source prose gate: no internal leak in a .changeset/*.md body
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
    `  alongside in CI (ADR-0022): oxlint provider-SDK signal + the lint canary + dependency-cruiser graph reach + golden (ADR-0013).\n`,
  );
  return errors.length > 0 ? 1 : 0;
}

process.exit(await main());
