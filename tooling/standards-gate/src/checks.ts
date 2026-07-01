/**
 * Gate checks (ADR-0022). Each returns Finding[]; severity "error" fails the gate, "warn" reports.
 * Division of labor (ADR-0022): this Bun script is the SPDX/license authority (AGPL boundary over
 * the resolved tree + manifest↔package.json agreement); dependency-cruiser owns the real module
 * graph (dynamic import()/require + transitive provider-SDK reachability + down-only direction);
 * ESLint is the fast static source signal.
 *
 * Provider-SDK reachability is NOT re-implemented here (no allow-set): the confinement of the
 * Vercel AI SDK family — `ai` core + `@ai-sdk/{openai,anthropic,google,openrouter}` — to
 * @caisson/ai-config + @caisson/ai-kit is owned by the eslint denylist (boundaries.js, Gate 2)
 * and the dependency-cruiser graph (.dependency-cruiser.cjs, authoritative). License-wise the AI
 * SDK family is Apache-2.0, so it passes the Gate 1/1b AGPL tripwire below by construction; its
 * only constraint is composition (ADR-0011/0022), not copyleft.
 */
import { join } from "node:path";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import type { Pkg } from "./workspace";
import { isAgpl } from "./workspace";

/** The four editions (by package name) — the down-only direction is keyed on these until manifests land. */
const EDITION_NAMES = new Set([
  "@caisson/compliance",
  "@caisson/ai-kit",
  "@caisson/local-ai",
  "@caisson/agent-dev",
]);

// Open-core (ADR-0094/0097). The open Base substrate ships `Apache-2.0`; every OTHER published module
// (editions + their members, the compliance primitives field-crypto/audit-worm, the commercial
// registry SERVICE, updates, the pricebook) ships `LicenseRef-Caisson-Commercial`. The open set is the
// ADR-0094 ten PLUS `@caisson/registry-schema` (the open registry contract split out by ADR-0097),
// `@caisson/observability` (ADR-0117), and the ships-with-generator tooling trio cli·migrate·
// license-verify (ADR-0136): every buyer's generated repo embeds all three, so they are open Base,
// not sold à-la-carte. `@caisson/pricebook` stays commercial (it is the seller's price catalog).
const OPEN_LICENSE = "Apache-2.0";
const COMMERCIAL_LICENSE = "LicenseRef-Caisson-Commercial";
const OPEN_BASE_NAMES = new Set([
  "@caisson/kernel",
  "@caisson/auth",
  "@caisson/tenancy-rls",
  "@caisson/ui",
  "@caisson/billing",
  "@caisson/credits",
  "@caisson/jobs",
  "@caisson/email",
  "@caisson/ai-config",
  "@caisson/mcp-server",
  "@caisson/registry-schema",
  // ADR-0117: vendor-neutral OTel bootstrap is base substrate every buyer gets, same as the rest
  // of the open Base set above — never edition-gated.
  "@caisson/observability",
  // ADR-0136: ships-with-generator tooling. create-caisson (cli) composes migrate + embeds the
  // offline license verifier into EVERY generated repo, so all three ship with each buyer and are
  // open Apache-2.0 Base — never gated, never sold à-la-carte. cli→credits·kernel·migrate·
  // registry-schema, migrate→kernel, license-verify→kernel: all open, so open-only holds (ADR-0094).
  "@caisson/cli",
  "@caisson/migrate",
  "@caisson/license-verify",
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
 * DORMANT TRIPWIRE (ADR-0050/0094). Under the open-core model (ADR-0094: base Apache-2.0, editions/
 * primitives/cli/registry commercial; amends the ADR-0050 uniform-commercial stance) the SPDX
 * allowlist is {Commercial, Apache-2.0} — still NO AGPL/copyleft source in the tree, so Gate 1
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

/** SSPL per SPDX (`SSPL-1.0` etc.) — the other copyleft license this tree must never carry. */
function isSspl(license: string | null): boolean {
  return license !== null && /\bSSPL\b/i.test(license);
}

const isForbiddenLicense = (license: string | null): boolean =>
  isAgpl(license) || isSspl(license);

/**
 * npm's `license` field has three live shapes in the wild: the modern SPDX string, the legacy
 * `{ type: "..." }` object, and the older-still `licenses: [{ type: "..." }, ...]` array — all three
 * still appear in real published packages. Reading only the string form treats an object/array
 * form as unlicensed, which PASSES the AGPL tripwire it should trip.
 */
function parseLicenseField(pkgJson: unknown): string | null {
  if (typeof pkgJson !== "object" || pkgJson === null) return null;
  const j = pkgJson as Record<string, unknown>;
  if (typeof j.license === "string") return j.license;
  if (typeof j.license === "object" && j.license !== null) {
    const type = (j.license as Record<string, unknown>).type;
    if (typeof type === "string") return type;
  }
  if (Array.isArray(j.licenses) && j.licenses.length > 0) {
    const first = j.licenses[0] as Record<string, unknown> | undefined;
    if (first && typeof first.type === "string") return first.type;
  }
  return null;
}

function licenseOf(packageJsonPath: string): string | null {
  if (!existsSync(packageJsonPath)) return null;
  try {
    return parseLicenseField(JSON.parse(readFileSync(packageJsonPath, "utf8")));
  } catch {
    return null;
  }
}

/**
 * Recursively walks an installed node_modules tree, checking every package's license. bun hoists,
 * but a version conflict still leaves a nested node_modules — this follows those too, so a
 * transitive AGPL/SSPL dep can't hide two levels down. A scoped dir (`@scope/`) is one more path
 * segment, not a separate node_modules level. `.bin` is skipped (never a package), and a
 * visited-realpath set both breaks symlink cycles (workspace links, content-addressable stores)
 * and dedupes a package hoisted/linked into more than one spot.
 */
function walkForForbiddenLicenses(
  dir: string,
  relPath: string,
  visited: Set<string>,
  out: { relPath: string; license: string }[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === ".bin") continue;
    const entryPath = join(dir, entry);
    let real: string;
    try {
      real = realpathSync(entryPath);
    } catch {
      continue; // broken symlink
    }
    if (visited.has(real)) continue;
    visited.add(real);
    if (!statSync(entryPath).isDirectory()) continue;
    const entryRel = `${relPath}${entry}`;
    if (entry.startsWith("@")) {
      // Scope namespace — its children are the real packages, not another node_modules level.
      walkForForbiddenLicenses(entryPath, `${entryRel}/`, visited, out);
      continue;
    }
    const license = licenseOf(join(entryPath, "package.json"));
    if (isForbiddenLicense(license)) {
      out.push({ relPath: entryRel, license: license as string });
    }
    const nested = join(entryPath, "node_modules");
    if (existsSync(nested)) {
      walkForForbiddenLicenses(
        nested,
        `${entryRel}/node_modules/`,
        visited,
        out,
      );
    }
  }
}

/**
 * Gate 1b — AGPL/SSPL boundary over the INSTALLED (npm) tree. The workspace check misses an
 * external copyleft lib; a per-package direct-dep lookup misses one pulled in transitively (a dep
 * of a dep). When node_modules is present this walks the whole resolved tree — direct and nested —
 * so a transitive offender can't escape the tripwire the docstring above already claims to run;
 * otherwise WARN that the scan was skipped (CI must run it post-install). dependency-cruiser
 * backstops dynamic reach; it cannot read SPDX/license fields, so this stays the license authority.
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
  // `pkgs` isn't needed to walk the installed tree (an offender is disqualifying regardless of
  // which workspace package's manifest pulled it in) — kept in the signature for call-site
  // stability with the other gates in cli.ts.
  void pkgs;
  const offenders: { relPath: string; license: string }[] = [];
  walkForForbiddenLicenses(nm, "node_modules/", new Set<string>(), offenders);
  return offenders.map((o) => ({
    severity: "error",
    rule: "agpl-external",
    pkg: "(external-tree)",
    message: `external dependency at ${o.relPath} carries a forbidden copyleft license (${o.license}) — AGPL/SSPL may not enter the tree, direct or transitive (ADR-0010).`,
  }));
}

/** Gate 3 — down-only dependency boundary (ADR-0003). base/primitive ↛ edition; edition ↛ edition. */
export function checkDownOnly(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    // Down-only governs the PACKAGE dependency tower (base/primitive/edition) only (ADR-0003).
    // apps/ are reference applications ABOVE the tower — top-level consumers, not packages — so they
    // may legitimately depend on an edition (each edition's reference app wires its edition). The
    // authoritative .dependency-cruiser.cjs likewise anchors its down-only `from` to packages/, so
    // gating on isModuleCandidate keeps the two enforcement layers aligned. Base/primitive (in
    // packages/) stay fully checked — this exempts the consumer layer, not the tower.
    if (!isModuleCandidate(p)) continue;
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
      const msg = (e as Error).message ?? String(e);
      // A genuine module-RESOLUTION failure (deps not installed — e.g. the pre-install CI pass) stays
      // a non-blocking warn. ANY OTHER load failure is fail-closed to an ERROR: notably a ZodError
      // from `defineModule` rejecting the manifest at load (an invalid manifest — incl. a license⟺tier
      // violation, ADR-0094/0097) must HARD-FAIL, since this gate is the registry-ingress authority
      // and must not pass a manifest the schema rejects.
      const isResolutionFailure =
        (e as { code?: string }).code === "ERR_MODULE_NOT_FOUND" ||
        /cannot find (module|package)|failed to resolve/i.test(msg);
      findings.push({
        severity: isResolutionFailure ? "warn" : "error",
        rule: "manifest-agreement",
        pkg: p.name,
        message: isResolutionFailure
          ? `could not RESOLVE manifest.ts deps (${msg}) — agreement check skipped; CI must run post-install.`
          : `manifest.ts failed to load/validate (${msg}) — defineModule rejected it (ADR-0020/0094/0097).`,
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

/**
 * Gate #4 — TS-compiler copy-guard (ADR-0101). Flags a source module COPY-PASTED across packages:
 * two `src/**` modules in *different* workspace packages whose code is token-identical. The motivating
 * case is the contrast spot-check that was hand-duplicated (and drifted) across apps/site + apps/studio
 * (ADR-0101 Context) — shared logic belongs in ONE package, imported, not copied.
 *
 * Normalization is done with the TypeScript SCANNER (not a text hash): trivia — all whitespace AND
 * comments — is skipped, so reformatting or a reworded header never hides a copy, and a genuine
 * comment-only difference never *creates* a false copy. Files below MIN_TOKENS are ignored so trivial
 * re-export barrels / tiny stubs that happen to coincide don't trip the gate. Tests + .d.ts + golden
 * fixtures are out of scope (intentional shared shapes / generated).
 */
const COPY_MIN_TOKENS = 80;

function tokenizeNormalized(src: string): { norm: string; count: number } {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ true,
    ts.LanguageVariant.JSX,
    src,
  );
  const toks: string[] = [];
  let k = scanner.scan();
  while (k !== ts.SyntaxKind.EndOfFileToken) {
    toks.push(scanner.getTokenText());
    k = scanner.scan();
  }
  return { norm: toks.join(""), count: toks.length };
}

const COPY_SKIP =
  /(?:\.test\.|\.integration\.test\.|\.d\.ts$|__golden__|[/\\](?:dist|node_modules|\.next|\.turbo)[/\\])/;

export function checkCopyPaste(root: string): Finding[] {
  // Bun.Glob (this gate runs under bun, via cli.ts). `{packages,apps,tooling}/*/src/**` is the
  // published+app+tooling source surface; the leading `*` is the package dir → the "different
  // package" key.
  const glob = new Bun.Glob("{packages,apps,tooling}/*/src/**/*.{ts,tsx}");
  const byHash = new Map<string, { file: string; pkg: string }[]>();
  for (const rel of glob.scanSync({ cwd: root })) {
    if (COPY_SKIP.test(rel)) continue;
    const { norm, count } = tokenizeNormalized(
      readFileSync(join(root, rel), "utf8"),
    );
    if (count < COPY_MIN_TOKENS) continue;
    const hash = createHash("sha256").update(norm).digest("hex");
    const pkg = rel.split(/[/\\]/).slice(0, 2).join("/");
    const bucket = byHash.get(hash) ?? [];
    bucket.push({ file: rel, pkg });
    byHash.set(hash, bucket);
  }
  const findings: Finding[] = [];
  for (const group of byHash.values()) {
    const pkgs = new Set(group.map((g) => g.pkg));
    // Only ACROSS packages — an intentional in-package duplicate is a different (local) smell.
    if (group.length > 1 && pkgs.size > 1) {
      findings.push({
        severity: "error",
        rule: "copy-guard",
        pkg: [...pkgs].join(", "),
        message: `token-identical module copy-pasted across packages: ${group
          .map((g) => g.file)
          .join(
            " ≡ ",
          )} — extract to ONE shared package and import it, don't copy (ADR-0101 #4).`,
      });
    }
  }
  return findings;
}

/**
 * Open-core licensing split (ADR-0094/0097). Every shipped `packages/` module must carry the license
 * its tier mandates: the open Base set (`OPEN_BASE_NAMES`) ships `Apache-2.0`; every other module
 * ships `LicenseRef-Caisson-Commercial`. This is the gate change ADR-0094 scheduled (it replaces the
 * former implicit "all modules commercial" posture). The commercial registry SERVICE lives at
 * `registry/` (outside `packages/`) so it is not a module candidate here — only the open registry
 * CONTRACT, `@caisson/registry-schema` under `packages/`, is checked (and must be open). A missing
 * `license` is `checkDeclarations`' job, so an unlicensed package is skipped here (not double-flagged).
 */
export function checkOpenCoreLicensing(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (!isModuleCandidate(p) || !p.hasCode || !p.license) continue;
    const shouldBeOpen = OPEN_BASE_NAMES.has(p.name);
    const expected = shouldBeOpen ? OPEN_LICENSE : COMMERCIAL_LICENSE;
    if (p.license !== expected) {
      findings.push({
        severity: "error",
        rule: "open-core-license",
        pkg: p.name,
        message: `${shouldBeOpen ? "open Base" : "commercial"} module must ship ${expected} (ADR-0094/0097); found ${p.license}.`,
      });
    }
  }
  return findings;
}

/**
 * Open↔commercial no-depend-up boundary (ADR-0094/0097). An open (`Apache-2.0`) package may depend
 * only on other open packages — the open Base must be resolvable against open deps alone (the
 * acquisition/trust premise of ADR-0094). A commercial package may depend on anything (commercial→open
 * is always fine). Keyed on the package's actual SPDX `license` (not a name allowlist) so it stays
 * correct if the open set changes. This is the LICENSE-keyed half of the boundary; dependency-cruiser
 * (which cannot read SPDX) owns the graph-direction half (down-only base↛edition), per ADR-0022.
 */
export function checkOpenCommercialBoundary(pkgs: Pkg[]): Finding[] {
  const licenseByName = new Map(pkgs.map((p) => [p.name, p.license]));
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (!isModuleCandidate(p) || p.license !== OPEN_LICENSE) continue;
    for (const dep of p.workspaceDeps) {
      // workspaceDeps are @caisson/* runtime deps only (devDeps excluded — they don't ship). An open
      // package must resolve every one to an in-workspace OPEN package. Fail closed: a non-open dep
      // OR a dep absent from the workspace (an external/renamed @caisson pkg we can't verify is open)
      // is a violation — never silently allowed.
      const depLicense = licenseByName.get(dep);
      if (depLicense === OPEN_LICENSE) continue;
      findings.push({
        severity: "error",
        rule: "open-core-boundary",
        pkg: p.name,
        message:
          depLicense === undefined
            ? `open (Apache-2.0) package depends on @caisson dep ${dep} absent from the workspace — cannot verify it is open; the open Base must resolve against open packages only (ADR-0094/0097).`
            : `open (Apache-2.0) package depends "up" on non-open ${dep} (${depLicense ?? "unlicensed"}) — the open Base must depend only on open packages (ADR-0094/0097).`,
      });
    }
  }
  return findings;
}
