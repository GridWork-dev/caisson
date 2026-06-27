/**
 * Gate checks (ADR-0022). Each returns Finding[]; severity "error" fails the gate, "warn" reports.
 * Division of labor (ADR-0022): this Bun script is the SPDX/license authority (AGPL boundary over
 * the resolved tree + manifest↔package.json agreement); dependency-cruiser owns the real module
 * graph (dynamic import()/require + transitive provider-SDK reachability + down-only direction);
 * ESLint is the fast static source signal.
 */
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { Pkg } from "./workspace";
import { isAgpl } from "./workspace";

/** The four editions (by package name) — the down-only direction is keyed on these until manifests land. */
const EDITION_NAMES = new Set([
  "@caisson/compliance",
  "@caisson/ai-kit",
  "@caisson/local-ai",
  "@caisson/agent-dev",
]);

// A registry-module candidate is a `packages/` member. `apps/` are reference applications (the
// base/edition reference apps + the design studio) — never published to the registry, so they are
// not held to the module declaration rules (they still face the AGPL + down-only checks below).
const isModuleCandidate = (p: Pkg): boolean =>
  p.dir.includes("/packages/") || p.dir.includes("\\packages\\");

export interface Finding {
  severity: "error" | "warn";
  rule: string;
  pkg: string;
  message: string;
}

/**
 * DORMANT TRIPWIRE (ADR-0050). Under the uniform fully-commercial model — ADR-0050 retired the lone
 * AGPL Local-first flank ADR-0023 carved out — NO AGPL/copyleft source exists in the tree, so Gate 1
 * and Gate 1b NEVER fire by construction: there is no AGPL package for them to catch. They stay
 * wired ON PURPOSE as a standing tripwire — a re-introduced AGPL dependency (workspace OR external
 * npm) MUST still hard-fail CI. Do not delete: this is the guard that keeps copyleft out of the
 * commercial tree even though it is dormant today.
 *
 * Gate 1 — AGPL boundary over WORKSPACE deps. Only an AGPL package may consume an AGPL package.
 */
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

/**
 * A `packages/` member that ships code must declare an SPDX license now (ADR-0023 — every module
 * is licensed). The `manifest.ts` is the registry-publish declaration that lands at P5 (ADR-0021
 * T5.1b backfill), so its absence is a WARN pre-publish, not a build-blocking error — the manifest
 * becomes mandatory at the registry-ingress (publish) step, which this same gate guards.
 */
export function checkDeclarations(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (!isModuleCandidate(p) || !p.hasCode) continue;
    if (!p.license)
      findings.push({
        severity: "error",
        rule: "license-required",
        pkg: p.name,
        message: `shipped module has no SPDX \`license\` in package.json (ADR-0020/0023).`,
      });
    if (!p.manifestPath)
      findings.push({
        severity: "warn",
        rule: "manifest-pending",
        pkg: p.name,
        message: `no manifest.ts yet — registry manifests land at P5 (ADR-0021 T5.1b backfill); mandatory at publish.`,
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
    let manifest: {
      id?: string;
      version?: string;
      license?: string;
      dependencies?: string[];
    };
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
    // manifest.dependencies (@caisson/*) must match package.json's @caisson deps — else the index
    // (built from the manifest) advertises a dep graph the package doesn't have (down-only runs
    // on package.json deps, so a divergent manifest array escapes it otherwise).
    const md = [...(manifest.dependencies ?? [])].sort().join(",");
    const pd = [...p.workspaceDeps].sort().join(",");
    mismatch("dependencies", md, pd);
  }
  return findings;
}
