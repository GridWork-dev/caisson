#!/usr/bin/env bun
/**
 * `stack-gate` — the standards-gate CLI (ADR-0021/0022). The ONLY registry ingress runs through
 * this. Exit non-zero on any "error" finding → fails CI + `bun run check` + blocks publish.
 *
 * Runs here (executable now): AGPL boundary, license/manifest declarations, down-only (scaffold).
 * Delegated (wired by the foundations track): provider-SDK boundary → ESLint
 * (tooling/eslint-config/boundaries.js); golden-file regression → the ADR-0013 harness. The
 * publish job calls `stack-gate` then `eslint` then the golden run; a green run stamps the
 * registry-index `gateAttestation` (ADR-0021).
 */
import { readWorkspace } from "./workspace";
import {
  checkAgplBoundary,
  checkDeclarations,
  checkDownOnly,
  type Finding,
} from "./checks";

function main(): number {
  const pkgs = readWorkspace();
  const findings: Finding[] = [
    ...checkAgplBoundary(pkgs),
    ...checkDeclarations(pkgs),
    ...checkDownOnly(pkgs),
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
    `  reminder: provider-SDK boundary (ESLint) + golden-file regression (ADR-0013) run alongside this in CI.\n`,
  );
  return errors.length > 0 ? 1 : 0;
}

process.exit(main());
