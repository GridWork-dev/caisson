/**
 * Gate checks (ADR-0022). Each returns Finding[]; severity "error" fails the gate, "warn" reports.
 * - Gate 1: AGPL import boundary (ADR-0010) — only an AGPL package may consume an AGPL package.
 * - Gate 3: down-only dependency boundary (ADR-0003) — handled via manifests (scaffold below).
 * - manifest/license presence — a shipped (has-code) package must declare both.
 * Gate 2 (provider-SDK import boundary) is ESLint's job (tooling/eslint-config/boundaries.js).
 */
import { sep } from "node:path";
import type { Pkg } from "./workspace";
import { isAgpl } from "./workspace";

/** A registry-module candidate (packages/* or apps/*) — tooling/ + services/ are infra, not modules. */
const isModuleCandidate = (p: Pkg): boolean =>
  p.dir.includes(`${sep}packages${sep}`) || p.dir.includes(`${sep}apps${sep}`);

export interface Finding {
  severity: "error" | "warn";
  rule: string;
  pkg: string;
  message: string;
}

/** Gate 1 — AGPL boundary. Keyed on package.json `license` (absent ⇒ treated non-AGPL). */
export function checkAgplBoundary(pkgs: Pkg[]): Finding[] {
  const license = new Map(pkgs.map((p) => [p.name, p.license]));
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (isAgpl(p.license)) continue; // an AGPL package may consume AGPL freely
    for (const dep of p.workspaceDeps) {
      if (isAgpl(license.get(dep) ?? null)) {
        findings.push({
          severity: "error",
          rule: "agpl-boundary",
          pkg: p.name,
          message: `non-AGPL package depends on AGPL package ${dep} — would contaminate buyers (ADR-0010). Either route through a non-AGPL seam or license ${p.name} AGPL.`,
        });
      }
    }
  }
  return findings;
}

/** A package that ships code must declare a license + a manifest (ADR-0020). */
export function checkDeclarations(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (!isModuleCandidate(p)) continue; // tooling/ + services/ are infra, not registry modules
    if (!p.hasCode) continue; // scaffolds (src/.gitkeep only) are exempt until they ship code
    if (!p.license)
      findings.push({
        severity: "error",
        rule: "license-required",
        pkg: p.name,
        message: `shipped package has no SPDX \`license\` in package.json (ADR-0020/0022).`,
      });
    if (!p.hasManifest)
      findings.push({
        severity: "error",
        rule: "manifest-required",
        pkg: p.name,
        message: `shipped package has no manifest.ts (ADR-0020).`,
      });
  }
  return findings;
}

/**
 * Gate 3 — down-only dependency boundary (ADR-0003). Needs each module's manifest `kind`. Until
 * manifests exist this is a no-op scaffold; once they do, dynamic-import each manifest.ts, build
 * id→kind, and flag base/primitive→edition or edition→edition deps. Tracked: P5 backfill.
 */
export function checkDownOnly(_pkgs: Pkg[]): Finding[] {
  return [];
}
