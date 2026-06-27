/**
 * Gate checks (ADR-0022). Each returns Finding[]; severity "error" fails the gate, "warn" reports.
 * Division of labor (ADR-0022): this Bun script is the SPDX/license authority (AGPL boundary over
 * the resolved tree + manifest↔package.json agreement); dependency-cruiser owns the real module
 * graph (dynamic import()/require + transitive provider-SDK reachability + down-only direction);
 * ESLint is the fast static source signal.
 */
import { join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { Pkg } from "./workspace";
import { isAgpl } from "./workspace";

/** The four editions (by package name) — the down-only direction is keyed on these until manifests land. */
const EDITION_NAMES = new Set([
  "@stack/compliance",
  "@stack/ai-kit",
  "@stack/local-ai",
  "@stack/agent-dev",
]);

const isModuleCandidate = (p: Pkg): boolean =>
  p.dir.includes("/packages/") ||
  p.dir.includes("/apps/") ||
  p.dir.includes("\\packages\\") ||
  p.dir.includes("\\apps\\");

export interface Finding {
  severity: "error" | "warn";
  rule: string;
  pkg: string;
  message: string;
}

/** Gate 1 — AGPL boundary over WORKSPACE deps. Only an AGPL package may consume an AGPL package. */
export function checkAgplBoundary(pkgs: Pkg[]): Finding[] {
  const license = new Map(pkgs.map((p) => [p.name, p.license]));
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (isAgpl(p.license)) continue;
    for (const dep of p.workspaceDeps) {
      if (isAgpl(license.get(dep) ?? null)) {
        findings.push({
          severity: "error",
          rule: "agpl-boundary",
          pkg: p.name,
          message: `non-AGPL package depends on AGPL package ${dep} — would contaminate buyers (ADR-0010).`,
        });
      }
    }
  }
  return findings;
}

/**
 * Gate 1b — AGPL boundary over EXTERNAL (npm) deps. The workspace check misses an external AGPL
 * lib. When node_modules is present, read each external dep's package.json `license`; otherwise
 * WARN that the resolved-tree scan was skipped (CI must run it post-install). dependency-cruiser
 * backstops dynamic/transitive reach.
 */
export function checkExternalAgpl(pkgs: Pkg[], root: string): Finding[] {
  const nm = join(root, "node_modules");
  if (!existsSync(nm)) {
    return [
      {
        severity: "warn",
        rule: "agpl-external",
        pkg: "(workspace)",
        message: `node_modules absent — external-dep AGPL scan skipped. CI must run this post-install (ADR-0022).`,
      },
    ];
  }
  const findings: Finding[] = [];
  const licenseOf = (depName: string): string | null => {
    const pj = join(nm, depName, "package.json");
    if (!existsSync(pj)) return null;
    try {
      const j = JSON.parse(readFileSync(pj, "utf8"));
      return typeof j.license === "string" ? j.license : null;
    } catch {
      return null;
    }
  };
  for (const p of pkgs) {
    if (isAgpl(p.license)) continue;
    for (const dep of p.externalDeps) {
      if (isAgpl(licenseOf(dep))) {
        findings.push({
          severity: "error",
          rule: "agpl-external",
          pkg: p.name,
          message: `non-AGPL package depends on AGPL npm package ${dep} (ADR-0010).`,
        });
      }
    }
  }
  return findings;
}

/** Gate 3 — down-only dependency boundary (ADR-0003). base/primitive ↛ edition; edition ↛ edition. */
export function checkDownOnly(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    const pIsEdition = EDITION_NAMES.has(p.name);
    for (const dep of p.workspaceDeps) {
      if (EDITION_NAMES.has(dep) && dep !== p.name) {
        findings.push({
          severity: "error",
          rule: "down-only",
          pkg: p.name,
          message: `${pIsEdition ? "edition" : "base/primitive"} depends "up" on edition ${dep} — editions compose base, never the reverse (ADR-0003).`,
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
    if (!isModuleCandidate(p) || !p.hasCode) continue;
    if (!p.license)
      findings.push({
        severity: "error",
        rule: "license-required",
        pkg: p.name,
        message: `shipped module has no SPDX \`license\` in package.json (ADR-0020/0022).`,
      });
    if (!p.manifestPath)
      findings.push({
        severity: "error",
        rule: "manifest-required",
        pkg: p.name,
        message: `shipped module has no manifest.ts (ADR-0020).`,
      });
  }
  return findings;
}

/**
 * manifest↔package.json agreement (ADR-0020/0021). Loads each manifest.ts (needs zod, so it is
 * best-effort: if the import fails — e.g. deps not installed — it WARNs rather than passing
 * silently). Asserts id/version/license match package.json so the catalog can't advertise a
 * different license than the package ships.
 */
export async function checkManifestAgreement(pkgs: Pkg[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (!p.manifestPath) continue;
    let manifest: { id?: string; version?: string; license?: string };
    try {
      const mod = await import(p.manifestPath);
      manifest = (mod.default ?? mod.manifest ?? mod) as typeof manifest;
    } catch (e) {
      findings.push({
        severity: "warn",
        rule: "manifest-agreement",
        pkg: p.name,
        message: `could not load manifest.ts (${(e as Error).message}) — agreement check skipped; CI must run post-install.`,
      });
      continue;
    }
    const mismatch = (field: string, a: unknown, b: unknown) =>
      a !== b &&
      findings.push({
        severity: "error",
        rule: "manifest-agreement",
        pkg: p.name,
        message: `manifest.${field} (${String(a)}) ≠ package.json (${String(b)}) — they must agree (ADR-0020).`,
      });
    mismatch("id", manifest.id, p.name);
    mismatch("version", manifest.version, p.version);
    mismatch("license", manifest.license, p.license);
  }
  return findings;
}
