#!/usr/bin/env bun
/**
 * `caisson-gate` — the standards-gate CLI (ADR-0021/0022). The ONLY registry ingress runs through
 * this. Exit non-zero on any "error" finding → fails the CI `standards-gate` job + blocks publish.
 * (Run via the CI job or `bun run gate`; it is NOT part of `bun run check`/turbo.)
 *
 * CI runs it TWICE (ci.yml): once pre-install (fs-only checks survive a broken install) and once
 * post-install — the post-install pass is where checkExternalAgpl + checkManifestAgreement (which
 * need node_modules) actually execute. A single pre-install run leaves those two skipped.
 *
 * This Bun script is the SPDX/license authority: AGPL boundary (workspace + external tree),
 * down-only direction, declarations, manifest↔package.json agreement, and hand-written-migration-
 * RLS-vs-generator equivalence (ADR-0210/0005). Run ALONGSIDE in CI
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
  checkManifestPriceAgreement,
  checkPriceCoverage,
  checkOrphanSku,
  checkPricebookPriceAgreement,
  checkNamedEntitlementTargets,
  checkReservedIdsStaleness,
  checkCopyPaste,
  checkOpenCoreLicensing,
  checkOpenCommercialBoundary,
  checkRlsEquivalence,
  checkShippedProse,
  checkChangesetProse,
  checkEntitlementTokenScan,
  type Finding,
} from "./checks";

async function main(): Promise<number> {
  const root = findRoot();
  const pkgs = readWorkspace(root);
  const findings: Finding[] = [
    ...checkAgplBoundary(pkgs),
    ...checkExternalAgpl(pkgs, root),
    ...checkDownOnly(pkgs),
    ...checkOpenCoreLicensing(pkgs),
    ...checkOpenCommercialBoundary(pkgs),
    ...checkDeclarations(pkgs),
    ...(await checkManifestAgreement(pkgs)),
    ...(await checkManifestPriceAgreement(pkgs)), // manifest.priceCents vs the locked-ADR PRICE_AUTHORITY map
    ...(await checkPriceCoverage(pkgs)), // every sellable commercial SKU with a locked price has a PRICE_AUTHORITY row
    ...checkOrphanSku(pkgs), // no PRICE_AUTHORITY row without a real on-disk manifested package
    ...(await checkPricebookPriceAgreement(pkgs)), // PRICE_AUTHORITY ↔ pricebook SKU_RETAIL/BUNDLE_RETAIL agreement
    ...checkReservedIdsStaleness(root), // ERROR: reservation maps drift or an indexed id remains reserved
    ...checkNamedEntitlementTargets(root), // ERROR: a compat/runtime edge names a target no index backs
    ...checkCopyPaste(root), // ADR-0101 gate #4: cross-package copy-paste
    ...(await checkRlsEquivalence(pkgs, root)), // ADR-0210/0005: hand-written RLS vs the generator
    ...checkShippedProse(pkgs, root), // shipped-prose gate: no internal-only vocabulary in buyer-visible source
    ...checkChangesetProse(root), // changeset-source prose gate: no internal leak in a .changeset/*.md body
    ...checkEntitlementTokenScan(root), // P0 audit remediation: no committed prod-signed license token
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
