// Workflow-scope guard (ADR-0134 §3). Pure: given the domains a CI workflow/job DECLARES it's
// scoped to, and the paths it actually touched this run, flag any touched path that falls inside a
// domain's globs but that domain is NOT declared — catches scope creep (e.g. a design-gate job
// starting to touch an RLS migration file). No IO; the caller supplies `touchedPaths` (e.g. from
// `git diff --name-only`) and `domainGlobs` (e.g. `./domains.ts` reduced to `{ id: globs }`).
import { withId, type Finding } from "./findings.ts";

// ponytail: Bun's native glob (already a Bun-runtime package — see cli.ts `Bun.stdin`), so no
// minimatch dep and no hand-rolled matcher. Handles interior single/double stars — the manifest's
// real shapes (e.g. `packages/<pkg>/LICENSE`, globstar + `*rls*`), which a trailing-only matcher
// silently missed.
function matchesGlob(glob: string, path: string): boolean {
  return new Bun.Glob(glob).match(path);
}

/**
 * Returns a `high`-severity Finding for every (path, domain) pair where `path` matches one of
 * `domain`'s globs but `domain` isn't in `declaredDomains`. A path already inside a declared
 * domain, or matching no domain at all, never produces a finding.
 */
export function checkScope(
  declaredDomains: string[],
  touchedPaths: string[],
  domainGlobs: Record<string, string[]>,
): Finding[] {
  const declared = new Set(declaredDomains);
  const findings: Finding[] = [];
  for (const path of touchedPaths) {
    for (const [domain, globs] of Object.entries(domainGlobs)) {
      if (declared.has(domain)) continue;
      if (globs.some((g) => matchesGlob(g, path))) {
        findings.push(
          withId({
            domain,
            subject: path,
            title: `touched outside declared scope (domain: ${domain})`,
            severity: "high",
          }),
        );
      }
    }
  }
  return findings;
}
