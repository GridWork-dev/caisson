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
import { join, relative, sep } from "node:path";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";
import ts from "typescript";
import type { Pkg } from "./workspace";
import { isAgpl } from "./workspace";
import {
  ADR_ID_SOURCE,
  BARE_ADR,
  hasBareAdrInDescription,
  INTERNAL_TERM,
} from "./prose-regex";
// Type-only — erased at transpile, so it cannot break the pre-install fs-only pass (see
// checkRlsEquivalence's lazy VALUE import below for the runtime seam).
import type { buildTenantPolicySql as BuildTenantPolicySqlFn } from "@caisson/tenancy-rls";

/**
 * The bundle/edition meta-packages (by package name) — the down-only direction is keyed on these.
 * Hand-copy of the ADR-0257 bundle ids + the historical `kind:"edition"` meta-package names, which stay
 * served forever (ADR-0006 append-only ledger; ADR-0270 purged the edition PURCHASE ids but keeps the
 * index/ledger machinery). This check runs in the pre-install fs-only pass, so it cannot value-import the
 * workspace constant; keep this set in sync with the shipped edition + bundle meta-packages.
 */
export const EDITION_NAMES = new Set([
  // Legacy edition names (historical kind:"edition" entries stay valid forever, ADR-0257).
  "@caisson/compliance",
  "@caisson/ai-kit",
  "@caisson/local-ai",
  "@caisson/agent-dev",
  // ADR-0257 bundle ids (compliance keeps its id — shared with the legacy row above).
  "@caisson/ai-production",
  "@caisson/local-first",
  "@caisson/agentic-dev",
  "@caisson/provenance",
  "@caisson/everything",
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
  // open Apache-2.0 Base — never gated, never sold à-la-carte. cli→kernel·migrate·registry-schema
  // (the codegen debit is an injected port; the commercial @caisson/credits — flipped by ADR-0249
  // G5/ADR-0260 — is dev-only), migrate→kernel, license-verify→kernel: all open, so open-only
  // holds (ADR-0094).
  "@caisson/cli",
  "@caisson/migrate",
  "@caisson/license-verify",
  // Shared abuse-throttle primitives (extracted out of two near-duplicate service-local copies plus
  // a per-account store that was marooned in a commercial service): generic infra, no commercial
  // secret, open Base alongside kernel/tenancy-rls.
  "@caisson/rate-limit",
  // Agent-ready design-system surface foundation layer (ADR-0330/ADR-0345): a manifest schema +
  // reader + pure static-check library with zero @caisson runtime deps (token objects and file
  // contents are always passed in by the caller) — generic infra, same open-Base posture as
  // registry-schema/rate-limit.
  "@caisson/ds-manifest",
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
 * `packages/` members that are internal engineering plumbing and will NEVER enter the sold
 * registry index — each one's own package.json `description` already says so in prose; this set
 * just makes that an enforced, auditable fact instead of a manifest-pending warning nobody will
 * ever clear. NOT inferred from `private: true` (several sellable modules may set that too for
 * unrelated npm-publish-prevention reasons) — every entry here is a deliberate opt-in with its
 * own one-line rationale, so a real future module can't slip past `manifest-pending` by accident.
 */
const NEVER_PUBLISHED = new Set([
  // The private brand layer (glyphs/wordmark) — apps consume it directly, never a registry SKU.
  "@caisson/brand",
  // The ordered platform migration chain — internal engineering plumbing, not a buyer module.
  "@caisson/platform-migrations",
]);

/**
 * A `packages/` member that ships code must declare an SPDX license now (ADR-0023 — every module
 * is licensed). The `manifest.ts` is the registry-publish declaration that lands at P5 (ADR-0021
 * T5.1b backfill), so its absence is a WARN pre-publish, not a build-blocking error — the manifest
 * becomes mandatory at the registry-ingress (publish) step, which this same gate guards. A
 * NEVER_PUBLISHED package is exempt from that warn (it will never reach publish to clear it) but
 * still faces the `license-required` error above — internal code still needs a real SPDX license.
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
    if (!p.manifestPath && !NEVER_PUBLISHED.has(p.name))
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
 * Every locked buyer-facing price, keyed by package id. The single place to update when an ADR
 * reprices a module — `checkManifestPriceAgreement` below fails the gate on any drift from here.
 */
export const PRICE_AUTHORITY: Record<string, { cents: number; adr: string }> = {
  // Compliance bundle repriced as the three compliance-gap members joined (was 104900/ADR-0258;
  // before that 79900/ADR-0227 as an edition).
  "@caisson/compliance": { cents: 164900, adr: "ADR-0383" },
  "@caisson/ai-production": { cents: 73900, adr: "ADR-0258" },
  "@caisson/local-first": { cents: 62900, adr: "ADR-0258" },
  "@caisson/agentic-dev": { cents: 32900, adr: "ADR-0260" },
  "@caisson/provenance": { cents: 39900, adr: "ADR-0260" },
  "@caisson/everything": { cents: 225900, adr: "ADR-0386" },
  "@caisson/audit-worm": { cents: 14900, adr: "ADR-0129" },
  // The surviving retired-alias meta stays trued to its alias-target bundle price.
  "@caisson/ai-kit": { cents: 73900, adr: "ADR-0258" },
  "@caisson/credits": { cents: 14900, adr: "ADR-0260" },
  "@caisson/field-crypto": { cents: 19900, adr: "ADR-0129" },
  "@caisson/retention-runner": { cents: 19900, adr: "ADR-0137" },
  "@caisson/alerting": { cents: 14900, adr: "ADR-0137" },
  "@caisson/ai-meter": { cents: 19900, adr: "ADR-0129" },
  "@caisson/ai-evals": { cents: 19900, adr: "ADR-0129" },
  "@caisson/guardrails": { cents: 14900, adr: "ADR-0129" },
  "@caisson/prompt-registry": { cents: 9900, adr: "ADR-0129" },
  "@caisson/local-store": { cents: 9900, adr: "ADR-0129" },
  "@caisson/agent-kernel": { cents: 19900, adr: "ADR-0129" },
  "@caisson/agent-runner": { cents: 4900, adr: "ADR-0222" },
  "@caisson/agent-trajectory": { cents: 4900, adr: "ADR-0379" },
  // Catalog-rework carves (all private pre-first-publish; prices locked by the rework pickers).
  "@caisson/org-controls": { cents: 24900, adr: "ADR-0257" },
  "@caisson/compliance-core": { cents: 29900, adr: "ADR-0260" },
  "@caisson/frameworks-pack": { cents: 24900, adr: "ADR-0260" },
  "@caisson/oscal-spine": { cents: 24900, adr: "ADR-0383" },
  "@caisson/signing-primitive": { cents: 19900, adr: "ADR-0260" },
  "@caisson/billing-orchestration": { cents: 9900, adr: "ADR-0260" },
  "@caisson/local-sync": { cents: 19900, adr: "ADR-0258" },
  "@caisson/local-inference": { cents: 24900, adr: "ADR-0258" },
  "@caisson/local-privacy": { cents: 9900, adr: "ADR-0258" },
  "@caisson/tool-exec": { cents: 9900, adr: "ADR-0260" },
  // ui-pro first publish (2026-07-07): trued to the live catalog $129 standalone (ADR-0259 band).
  "@caisson/ui-pro": { cents: 12900, adr: "ADR-0259" },
  // The 2026-07-20 compliance-gap SKUs (first prices; sellable flip in the membership cut).
  "@caisson/access-review": { cents: 19900, adr: "ADR-0373" },
  "@caisson/risk-register": { cents: 27900, adr: "ADR-0373" },
  "@caisson/trust-page": { cents: 14900, adr: "ADR-0373" },
};

/**
 * manifest.priceCents ↔ locked-ADR agreement. Root-cause guard for the audit-v2 P1 finding class
 * (manifests carrying stale/PLACEHOLDER prices that drifted from a later ADR reprice): only
 * packages seeded in `PRICE_AUTHORITY` are asserted — every other manifest.ts still carrying its
 * own unpriced/unlocked number is out of scope until it lands in the map. A load failure is
 * already reported by `checkManifestAgreement` above, so it is silently skipped here (no
 * double-report).
 */
export async function checkManifestPriceAgreement(
  pkgs: Pkg[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (!p.manifestPath) continue;
    const authority = PRICE_AUTHORITY[p.name];
    if (!authority) continue;
    let manifest: { priceCents?: number | null };
    try {
      const mod = await import(p.manifestPath);
      manifest = (mod.default ?? mod.manifest ?? mod) as typeof manifest;
    } catch {
      continue;
    }
    if (manifest.priceCents !== authority.cents) {
      findings.push({
        severity: "error",
        rule: "manifest-price-agreement",
        pkg: p.name,
        message: `manifest.priceCents (${String(manifest.priceCents)}) ≠ the price locked by ${authority.adr} (${authority.cents}) — reconcile the manifest, not the ADR.`,
      });
    }
  }
  return findings;
}

// ─── Catalog-rework gate checks (ADR-0248 F5, ADR-0257/0258) ─────────────────────────────────────
// Four checks that keep the sellable catalog, the manifest prices, the PRICE_AUTHORITY map, and the
// site's displayed catalog in agreement as editions dissolve into bundles. Each is a pure function
// over (disk, PRICE_AUTHORITY) like its siblings; all degrade to a skip/warn when node_modules or a
// cross-surface file is absent (the post-install CI pass is authoritative).

interface CatalogManifest {
  priceCents?: number | null;
  kind?: string;
  sellable?: boolean;
  members?: Record<string, string>;
}

/** Import a manifest's catalog fields; null if it can't be resolved (pre-install / broken load —
 *  the post-install gate pass re-runs it for real, mirroring checkManifestPriceAgreement's posture). */
async function loadCatalogManifestPath(
  manifestPath: string,
): Promise<CatalogManifest | null> {
  try {
    const mod = await import(manifestPath);
    return (mod.default ?? mod.manifest ?? mod) as CatalogManifest;
  } catch {
    return null;
  }
}

async function loadCatalogManifest(p: Pkg): Promise<CatalogManifest | null> {
  return p.manifestPath === null
    ? null
    : loadCatalogManifestPath(p.manifestPath);
}

/**
 * price-coverage (ADR-0248 F5). Every SELLABLE commercial `packages/*` module must carry a positive
 * integer price AND a PRICE_AUTHORITY row, so every shipped SKU's price is CI-pinned to its ADR and
 * can never silently drift. The only exemption is an explicit `sellable: false` declaration for
 * bundle-only, internal, retired, or unpublished packages. In particular, $49 is a legitimate
 * buyer price rather than a sentinel and bundle metas are themselves sellable SKUs.
 */
export async function checkPriceCoverage(pkgs: Pkg[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (
      !isModuleCandidate(p) ||
      p.license !== COMMERCIAL_LICENSE ||
      !p.manifestPath
    )
      continue;
    const m = await loadCatalogManifest(p);
    if (m === null) continue; // unresolvable pre-install — post-install pass is authoritative
    if (m.sellable === false) continue; // bundle-only substrate, never sold standalone
    if (
      typeof m.priceCents !== "number" ||
      !Number.isInteger(m.priceCents) ||
      m.priceCents <= 0
    ) {
      findings.push({
        severity: "error",
        rule: "price-coverage",
        pkg: p.name,
        message: `sellable commercial module carries no positive integer priceCents (found ${String(m.priceCents)}) — every sold SKU needs a price (ADR-0007).`,
      });
      continue;
    }
    if (!PRICE_AUTHORITY[p.name]) {
      findings.push({
        severity: "error",
        rule: "price-coverage",
        pkg: p.name,
        message: `sellable commercial module carries a locked price (${m.priceCents}) but has no PRICE_AUTHORITY row — add one keyed by ${p.name} so the manifest price stays CI-locked to its ADR.`,
      });
    }
  }
  return findings;
}

/**
 * orphan-SKU (ADR-0248 F5). The inverse of price-coverage: no PRICE_AUTHORITY row may name a package
 * that isn't a real, manifested `packages/*` module — a stale row (renamed/deleted package) would
 * assert a price nothing ships, and the price-drift guard would silently never fire for it.
 */
export function checkOrphanSku(pkgs: Pkg[]): Finding[] {
  const byName = new Map(pkgs.map((p) => [p.name, p]));
  const findings: Finding[] = [];
  for (const id of Object.keys(PRICE_AUTHORITY)) {
    const p = byName.get(id);
    if (!p || !isModuleCandidate(p) || !p.manifestPath) {
      findings.push({
        severity: "error",
        rule: "orphan-sku",
        pkg: id,
        message: !p
          ? `PRICE_AUTHORITY names ${id} but no such package exists on disk — remove the stale row or restore the package (ADR-0248 F5).`
          : `PRICE_AUTHORITY names ${id} but it is not a manifested packages/* module — a priced SKU must map to a real, manifested package (ADR-0248 F5).`,
      });
    }
  }
  return findings;
}

/**
 * pricebook-price-agreement (2026-07-20, the SKU-arming audit's structural finding). PRICE_AUTHORITY
 * pins manifests, and the site's displayed prices are test-pinned to the pricebook — but nothing
 * bridged the two, so a manifest reprice could leave the pricebook (and therefore the site display,
 * upgrade quotes, and renewal math) silently on the old number while every gate stayed green. This
 * check closes the bridge in BOTH directions: (a) for every PRICE_AUTHORITY row, the pricebook's
 * SKU_RETAIL (modules) or BUNDLE_RETAIL (bundles) entry must exist and agree at dollars * 100 ===
 * cents; (b) no pricebook row may name a slug PRICE_AUTHORITY does not lock — SKU_RETAIL doubles as
 * the F8 upgrade-CREDIT table and the creditable-item vocabulary (`resolveUpgradeCredit` /
 * `isPricedItem` read its keys), so an unlocked row is a live money number no ADR pins and no
 * sibling check asserts. Degrades to a
 * VISIBLE warn when the pricebook can't be imported (legitimate pre-install; post-install it means
 * the bridge is not running) — a silent skip here would false-PASS the exact drift class this
 * check exists to catch.
 */
export async function checkPricebookPriceAgreement(
  pkgs: Pkg[],
): Promise<Finding[]> {
  const pricebook = pkgs.find((p) => p.name === "@caisson/pricebook");
  if (!pricebook) return [];
  let books: {
    SKU_RETAIL?: Record<string, number>;
    BUNDLE_RETAIL?: Record<string, number>;
  };
  try {
    books = await import(join(pricebook.dir, "src", "upgrades.ts"));
  } catch {
    return [
      {
        severity: "warn",
        rule: "pricebook-price-agreement",
        pkg: "@caisson/pricebook",
        message:
          "src/upgrades.ts could not be imported — expected pre-install only; post-install this means the price-agreement bridge is NOT running (fix the import path).",
      },
    ];
  }
  const sku = books.SKU_RETAIL ?? {};
  const bundles = books.BUNDLE_RETAIL ?? {};
  const byName = new Map(pkgs.map((p) => [p.name, p]));
  const findings: Finding[] = [];
  for (const [id, { cents }] of Object.entries(PRICE_AUTHORITY)) {
    const slug = id.replace(/^@caisson\//, "");
    // Mirror checkPriceCoverage's sole exemption: sellable:false packages owe no pricebook row.
    const pkg = byName.get(id);
    const m = pkg ? await loadCatalogManifest(pkg) : null;
    if (m?.sellable === false) continue;
    const isBundle = slug in bundles;
    const dollars = isBundle ? bundles[slug] : sku[slug];
    if (dollars === undefined) {
      findings.push({
        severity: "error",
        rule: "pricebook-price-agreement",
        pkg: id,
        message: `PRICE_AUTHORITY locks ${id} at ${cents} cents but the pricebook carries no SKU_RETAIL/BUNDLE_RETAIL row for "${slug}" — without one, upgrade quotes credit $0 for it (silent overcharge).`,
      });
      continue;
    }
    if (dollars * 100 !== cents) {
      findings.push({
        severity: "error",
        rule: "pricebook-price-agreement",
        pkg: id,
        message: `pricebook ${isBundle ? "BUNDLE_RETAIL" : "SKU_RETAIL"}.${slug} = $${dollars} disagrees with PRICE_AUTHORITY's ${cents} cents — reprice both surfaces in the same change.`,
      });
    }
  }
  // Reverse direction (the missing leg): no pricebook row may name a slug PRICE_AUTHORITY does not
  // lock. SKU_RETAIL is the F8 upgrade-CREDIT table AND the creditable-item vocabulary
  // (`Object.keys(SKU_RETAIL)` / `Object.hasOwn(SKU_RETAIL, itemId)` in upgrades.ts), so an
  // unlocked row is a live buyer-facing number that no ADR pins and that every sibling check
  // (manifest-price-agreement, price-coverage, orphan-sku — all keyed off PRICE_AUTHORITY) skips.
  // A STALE one is worse: a renamed/retired slug stays a quotable, creditable item id for a SKU
  // that no longer ships. This mirrors checkOrphanSku on the pricebook side.
  const authoritySlugs = new Set(
    Object.keys(PRICE_AUTHORITY).map((id) => id.replace(/^@caisson\//, "")),
  );
  // A slug in BOTH books falls through both legs: the forward leg picks exactly one book per
  // authority row (`isBundle` short-circuits to BUNDLE_RETAIL), and the reverse leg tests only set
  // membership against the union, so the shadowed SKU_RETAIL row is never price-compared and never
  // orphan-flagged. Bundle ids and package slugs share one namespace — `compliance` is both a
  // bundle id and packages/compliance — so this is a live collision risk, and an unexamined
  // SKU_RETAIL row is a creditable money value (`upgrades.ts` reads its keys directly).
  for (const slug of Object.keys(sku)) {
    if (!(slug in bundles)) continue;
    findings.push({
      severity: "error",
      rule: "pricebook-price-agreement",
      pkg: `@caisson/${slug}`,
      message: `pricebook carries "${slug}" in BOTH SKU_RETAIL ($${sku[slug]}) and BUNDLE_RETAIL ($${bundles[slug]}) — the bundle row wins every comparison and the SKU row is never checked against PRICE_AUTHORITY, while still feeding upgrade credits; keep the slug in exactly one book.`,
    });
  }
  for (const [book, rows] of Object.entries({
    SKU_RETAIL: sku,
    BUNDLE_RETAIL: bundles,
  })) {
    for (const [slug, dollars] of Object.entries(rows)) {
      if (authoritySlugs.has(slug)) continue;
      findings.push({
        severity: "error",
        rule: "pricebook-price-agreement",
        pkg: `@caisson/${slug}`,
        message: `pricebook ${book}.${slug} = $${dollars} but no PRICE_AUTHORITY row locks @caisson/${slug} — an unpinned price still feeds upgrade credits and checkout quotes, and a stale slug keeps quoting a SKU that no longer ships; add the authority row or drop the pricebook entry.`,
      });
    }
  }
  return findings;
}

/** Latest-version members map per indexed module id, read off the PUBLISHED registry index — the
 *  source `membersOfBundle` (@caisson/registry-schema) actually resolves a live buyer's grants
 *  against (ADR-0071: "The registry INDEX is the single source of truth for membership"). null when
 *  the index is absent or unreadable, which skips the live leg (pre-publish posture). */
function readIndexMembers(indexPath: string): Map<string, Set<string>> | null {
  try {
    const idx = JSON.parse(readFileSync(indexPath, "utf8")) as {
      modules: {
        id: string;
        latest: string;
        versions: {
          version: string;
          manifest?: { members?: Record<string, unknown> };
        }[];
      }[];
    };
    const out = new Map<string, Set<string>>();
    for (const entry of idx.modules) {
      const v =
        entry.versions.find((x) => x.version === entry.latest) ??
        entry.versions[entry.versions.length - 1];
      out.set(entry.id, new Set(Object.keys(v?.manifest?.members ?? {})));
    }
    // A shape change to the index (`modules` gone or no longer an array) throws in the loop above
    // and lands here, indistinguishable from "no index yet" unless we say so — the caller treats
    // null as the legitimate pre-publish skip. Re-throw the distinguishable case so the caller can
    // report it instead of silently disabling the live leg forever.
    return out;
  } catch {
    if (existsSync(indexPath)) throw new Error("index-unreadable");
    return null;
  }
}

/** The site's bundle id → current workspace manifest path. The release train snapshots these
 * manifests into the append-only registry, so they are the correct parity source for a same-cut
 * catalog addition that has not reached registry/index.json yet. */
const SITE_BUNDLE_TO_MANIFEST_PATH: Record<string, string> = {
  compliance: "packages/compliance/manifest.ts",
  "ai-production": "packages/ai-production/manifest.ts",
  "local-first": "packages/local-first/manifest.ts",
  "agentic-dev": "packages/agentic-dev/manifest.ts",
  provenance: "packages/provenance/manifest.ts",
};

interface SitePricingModule {
  id: string;
  amount: number;
  bundles: readonly string[];
}

/**
 * catalog↔manifest parity (ADR-0248 F5). Promotes apps/site/lib/pricing.test.ts's membership lint to
 * the gate and adds a price cross-check, so the storefront can never advertise a grant or a price the
 * manifest layer doesn't back:
 *   (1) MEMBERSHIP (1:N), NEXT RELEASE — every bundle the site lists a module under must be a
 *       current workspace bundle manifest whose members map grants it (else the next release sells
 *       a grant that doesn't exist). ERROR.
 *   (1b) MEMBERSHIP, LIVE — the same claim re-checked against registry/index.json's PUBLISHED
 *       bundle entry, which is what `membersOfBundle` resolves a real buyer's grants from
 *       (ADR-0071). WARN, not error: the two-consume arming convention (publish the member first,
 *       fold the membership after) makes the workspace legitimately run ahead of the index mid-cut,
 *       so a red here would false-fail that convention's own PRs — but the window is exactly when
 *       the storefront is advertising a grant nothing behind it backs, so it must stay visible.
 *   (2) PRICE — for every à-la-carte module the site prices whose id carries a PRICE_AUTHORITY row,
 *       the displayed USD must equal the locked cents.
 * Bundle DISPLAY prices are out of scope here: apps/site/lib/pricing.test.ts pins BUNDLE_PRICES to
 * the pricebook's BUNDLE_RETAIL and re-verifies the below-sum invariant in the same CI run, so this
 * gate covers the à-la-carte module rows. Skips (warn) when a cross-surface file is absent.
 */
export async function checkCatalogParity(root: string): Promise<Finding[]> {
  const pricingPath = join(root, "apps/site/lib/pricing.ts");
  if (!existsSync(pricingPath)) {
    return [
      {
        severity: "warn",
        rule: "catalog-parity",
        pkg: "(catalog)",
        message: `apps/site/lib/pricing.ts absent — catalog↔manifest parity skipped; CI must run it against the full tree.`,
      },
    ];
  }
  // Read outside the try below: an ABSENT index (null) is the legitimate pre-publish posture and
  // must skip the live leg rather than warn the whole check away. An index that exists but will not
  // parse is a different thing entirely — it silently disabled this leg before, so it now reports.
  let indexMembers: Map<string, Set<string>> | null;
  try {
    indexMembers = readIndexMembers(join(root, "registry/index.json"));
  } catch {
    return [
      {
        severity: "error",
        rule: "catalog-parity-index-unreadable",
        pkg: "registry/index.json",
        message:
          "registry/index.json exists but could not be read in the expected shape — the live membership leg did not run",
      },
    ];
  }
  let modules: readonly SitePricingModule[];
  let members: Map<string, Set<string>>;
  try {
    const pricing = (await import(pricingPath)) as {
      MODULE_PRICES: readonly SitePricingModule[];
    };
    modules = pricing.MODULE_PRICES;
    members = new Map<string, Set<string>>();
    for (const [bundle, relativePath] of Object.entries(
      SITE_BUNDLE_TO_MANIFEST_PATH,
    )) {
      const manifest = await loadCatalogManifestPath(join(root, relativePath));
      if (manifest === null) {
        throw new Error(`could not load ${relativePath}`);
      }
      members.set(bundle, new Set(Object.keys(manifest.members ?? {})));
    }
  } catch (e) {
    return [
      {
        severity: "warn",
        rule: "catalog-parity",
        pkg: "(catalog)",
        message: `could not load the site catalog or bundle manifests (${(e as Error).message}) — catalog↔manifest parity skipped.`,
      },
    ];
  }

  const findings: Finding[] = [];
  for (const m of modules) {
    // (1) membership honesty (the promoted lint, 1:N): every bundle the site lists a module under
    //     must be a bundle whose current workspace manifest grants it. An empty bundles[] makes no
    //     claim (a genuinely standalone SKU).
    for (const bundle of m.bundles) {
      const manifestPath = SITE_BUNDLE_TO_MANIFEST_PATH[bundle];
      if (!manifestPath) {
        findings.push({
          severity: "error",
          rule: "catalog-parity",
          pkg: `@caisson/${m.id}`,
          message: `apps/site lists @caisson/${m.id} under an unknown bundle "${bundle}" — not a known persona/Provenance bundle id (ADR-0257).`,
        });
        continue;
      }
      const map = members.get(bundle);
      if (map === undefined) {
        findings.push({
          severity: "error",
          rule: "catalog-parity",
          pkg: `@caisson/${m.id}`,
          message: `apps/site lists @caisson/${m.id} in the ${bundle} bundle but ${manifestPath} has no readable members map — the membership claim cannot be verified (ADR-0257).`,
        });
      } else if (!map.has(`@caisson/${m.id}`)) {
        findings.push({
          severity: "error",
          rule: "catalog-parity",
          pkg: `@caisson/${m.id}`,
          message: `apps/site lists @caisson/${m.id} in the ${bundle} bundle but it is absent from ${manifestPath}'s members map — the next release would sell a grant that doesn't exist; fix bundles[] or repin the members (ADR-0071).`,
        });
      }
      // (1b) LIVE honesty — the leg the workspace-manifest swap dropped. The site deploys from main,
      //      but `membersOfBundle` (@caisson/registry-schema) resolves a buyer's grants from the
      //      PUBLISHED index, not this workspace manifest, so a member the workspace grants and the
      //      indexed bundle does not is being advertised to live buyers with nothing behind it.
      //      WARN because the two-consume arming convention legitimately opens this window mid-cut;
      //      the members-fold republish closes it. Skipped when the bundle is not indexed yet.
      const indexed = indexMembers?.get(`@caisson/${bundle}`);
      if (indexed !== undefined && !indexed.has(`@caisson/${m.id}`)) {
        findings.push({
          severity: "warn",
          rule: "catalog-parity",
          pkg: `@caisson/${m.id}`,
          message: `apps/site advertises @caisson/${m.id} in the ${bundle} bundle but registry/index.json's published @caisson/${bundle} entry does not grant it — a buyer today resolves NO grant for it (membersOfBundle reads the index, ADR-0071); republish the bundle before the storefront can honestly sell it.`,
        });
      }
    }
    // (2) price agreement, scoped to modules already locked in PRICE_AUTHORITY.
    const authority = PRICE_AUTHORITY[`@caisson/${m.id}`];
    if (authority && m.amount * 100 !== authority.cents) {
      findings.push({
        severity: "error",
        rule: "catalog-parity",
        pkg: `@caisson/${m.id}`,
        message: `apps/site prices @caisson/${m.id} at $${m.amount} (${m.amount * 100}¢) but PRICE_AUTHORITY (${authority.adr}) locks it at ${authority.cents}¢ — reconcile the display to the locked price.`,
      });
    }
  }
  return findings;
}

/** Extract the `RESERVED_MODULE_ENTITLEMENT_IDS` string set from entitlements.ts source (fs-only, so
 *  the check survives the pre-install pass and never drifts from a hand-copy — it reads live source).
 *  The optional generic matters: the real declaration is `new Set<string>([...])`, and a regex
 *  requiring bare `new Set(` silently parsed it to [] — a no-op staleness gate (audit P2-2). */
function parseReservedEntitlementIds(src: string): string[] {
  const block = src.match(
    /RESERVED_MODULE_ENTITLEMENT_IDS[^=]*=\s*new Set(?:<[^>]*>)?\(\s*\[([\s\S]*?)\]\s*\)/,
  );
  if (!block?.[1]) return [];
  return [...block[1].matchAll(/["']([a-z0-9-]+)["']/g)].map(
    (m) => m[1] as string,
  );
}

/** Extract `slug → first version` pairs from `RESERVED_MODULE_ENTITLEMENT_VERSIONS`. */
function parseReservedEntitlementVersions(src: string): Map<string, string> {
  const block = src.match(
    /RESERVED_MODULE_ENTITLEMENT_VERSIONS[^=]*=\s*new Map(?:<[^>]*>)?\(\s*\[([\s\S]*?)\]\s*\)/,
  );
  const entries = new Map<string, string>();
  if (!block?.[1]) return entries;
  for (const match of block[1].matchAll(
    /\[\s*["']([a-z0-9-]+)["']\s*,\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']\s*\]/g,
  )) {
    const slug = match[1];
    const version = match[2];
    if (slug !== undefined && version !== undefined) entries.set(slug, version);
  }
  return entries;
}

/**
 * Reserved-id lifecycle (ADR-0248 F5). `RESERVED_MODULE_ENTITLEMENT_IDS` is a fail-soft
 * carve-out for a SKU that is sold but not yet published — a purchased reserved id expands to nothing
 * rather than throwing. The matching first-version map lets bundle pins resolve during the same
 * pre-publish cut. Their keys must remain identical, and both exceptions must leave atomically when
 * the first registry row lands; otherwise a later missing pin can be hidden by a stale reservation.
 */
export function checkReservedIdsStaleness(root: string): Finding[] {
  const entPath = join(root, "packages/registry-schema/src/entitlements.ts");
  const indexPath = join(root, "registry/index.json");
  if (!existsSync(entPath) || !existsSync(indexPath)) return [];
  const source = readFileSync(entPath, "utf8");
  const reserved = new Set(parseReservedEntitlementIds(source));
  const reservedVersions = parseReservedEntitlementVersions(source);
  let indexed: Set<string>;
  try {
    const idx = JSON.parse(readFileSync(indexPath, "utf8")) as {
      modules: { id: string }[];
    };
    indexed = new Set(idx.modules.map((m) => m.id));
  } catch {
    return [];
  }
  const findings: Finding[] = [];
  const reservationKeys = new Set([...reserved, ...reservedVersions.keys()]);
  for (const id of reservationKeys) {
    if (!reserved.has(id) || !reservedVersions.has(id)) {
      findings.push({
        severity: "error",
        rule: "reserved-ids-staleness",
        pkg: `@caisson/${id}`,
        message: `pre-publish reservation keys drifted: "${id}" must appear in both RESERVED_MODULE_ENTITLEMENT_IDS and RESERVED_MODULE_ENTITLEMENT_VERSIONS, or in neither.`,
      });
    }
    if (indexed.has(`@caisson/${id}`)) {
      findings.push({
        severity: "error",
        rule: "reserved-ids-staleness",
        pkg: `@caisson/${id}`,
        message: `@caisson/${id} is published in the registry index but its pre-publish reservation remains — remove "${id}" from both RESERVED_MODULE_ENTITLEMENT_IDS and RESERVED_MODULE_ENTITLEMENT_VERSIONS in the version PR.`,
      });
    }
  }
  return findings;
}

/**
 * Extract every TARGET id from a `Map<string, readonly string[]>` of named entitlement edges.
 *
 * `null` means the DECLARATION could not be found or parsed — distinct from `[]`, which means it
 * parsed and is legitimately empty. This is a regex over source text, so any reshaping of the
 * declaration (a `satisfies` clause, entries hoisted to a named const, a builder call) makes it stop
 * seeing the real thing; collapsing that into `[]` would report a clean gate that measured nothing,
 * while the runtime half skips unresolvable edges silently by design.
 */
function parseNamedEntitlementTargets(
  src: string,
  constName: string,
): string[] | null {
  const block = src.match(
    new RegExp(
      `${constName}[^=]*=\\s*new Map(?:<[\\s\\S]*?>)?\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)\\s*;`,
    ),
  );
  if (!block) return null;
  // Each entry is `["@caisson/parent", ["@caisson/target", …]]` — the targets are every id after
  // the first in the entry, so match the inner array specifically.
  const targets: string[] = [];
  for (const entry of (block[1] ?? "").matchAll(
    /\[\s*["']@caisson\/[a-z0-9-]+["']\s*,\s*\[([\s\S]*?)\]\s*\]/g,
  )) {
    for (const id of (entry[1] ?? "").matchAll(
      /["'](@caisson\/[a-z0-9-]+)["']/g,
    )) {
      if (id[1] !== undefined) targets.push(id[1]);
    }
  }
  return targets;
}

/**
 * Gate — named-entitlement edges resolve (release audit v2026.07.27.1, F1).
 *
 * `addNamedEntitlementClosure` SKIPS an edge whose target is neither indexed nor reserved, because
 * throwing there would reject a paying buyer's entire entitlement set over one bad edge. That makes
 * the runtime quiet by design, so the loudness has to live here: an edge naming a target no index
 * entry backs is a build-time error, which is the moment it can still be fixed for free.
 *
 * Without this, adding a compatibility edge before its target ships would silently under-grant
 * every holder of the parent, and nothing would say so.
 */
export function checkNamedEntitlementTargets(root: string): Finding[] {
  const entPath = join(root, "packages/registry-schema/src/entitlements.ts");
  const indexPath = join(root, "registry/index.json");
  if (!existsSync(entPath) || !existsSync(indexPath)) return [];
  const source = readFileSync(entPath, "utf8");
  const reserved = new Set(parseReservedEntitlementIds(source));
  const findings: Finding[] = [];
  let indexed: Set<string>;
  try {
    const idx = JSON.parse(readFileSync(indexPath, "utf8")) as {
      modules: { id: string }[];
    };
    indexed = new Set(idx.modules.map((m) => m.id));
  } catch {
    // An index that EXISTS but will not parse is a broken gate, not a pre-publish posture — the
    // absent case already returned above. Returning [] here would report PASS while measuring
    // nothing, and the runtime half skips unresolvable edges silently by design, so both halves
    // would go quiet at once.
    return [
      {
        severity: "error",
        rule: "named-entitlement-target-gate-unreadable",
        pkg: "registry/index.json",
        message:
          "registry/index.json exists but could not be parsed — the named-entitlement target gate did not run",
      },
    ];
  }
  for (const constName of [
    "COMPATIBILITY_REEXPORT_ENTITLEMENTS",
    "INTERNAL_RUNTIME_ENTITLEMENTS",
  ]) {
    const parsed = parseNamedEntitlementTargets(source, constName);
    if (parsed === null) {
      findings.push({
        severity: "error",
        rule: "named-entitlement-target-gate-blind",
        pkg: "packages/registry-schema/src/entitlements.ts",
        message: `could not parse ${constName} — its declaration shape changed and this gate is no longer reading it, so an unresolvable edge would now pass silently at build time AND be skipped silently at runtime.`,
      });
      continue;
    }
    for (const target of parsed) {
      const slug = target.startsWith("@caisson/")
        ? target.slice("@caisson/".length)
        : target;
      if (indexed.has(target) || reserved.has(slug)) continue;
      findings.push({
        severity: "error",
        rule: "named-entitlement-target-unresolvable",
        pkg: target,
        message: `${constName} names "${target}", which is neither in registry/index.json nor a pre-publish reservation. The runtime skips such an edge (so a buyer silently loses it) — index the target, or add it to RESERVED_MODULE_ENTITLEMENT_IDS until it publishes.`,
      });
    }
  }
  return findings;
}

/**
 * Gate #4 — TS-compiler copy-guard (ADR-0101). Flags a source module COPY-PASTED across packages:
 * two `src/**` modules in *different* workspace packages whose code is token-identical. The motivating
 * case is the contrast spot-check that was hand-duplicated (and drifted) across apps/site + the
 * since-removed apps/studio (ADR-0101 Context) — shared logic belongs in ONE package, imported, not copied.
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

/**
 * RLS migration-equivalence harness (ADR-0210 hardening #2 / ADR-0005). `buildTenantPolicySql`
 * (@caisson/tenancy-rls) is the canonical RLS-SQL generator; nothing previously checked hand-written
 * migration RLS against it — a table can LOOK tenant-isolated but ship undocumented drift
 * (`retention_audit`/`alert_audit_log` already shipped narrower GRANTs than the generator would).
 *
 * Per package with `src/migrations/*.sql`: concatenate files in filename order, find every
 * tenant-table candidate (a `CREATE TABLE` with an `account_id`/`tenant_id` NOT NULL column), and
 * verify its hand-written RLS block against the generator's rendered output for that table.
 */
interface RlsOverride {
  table: string;
  package: string;
  reason: string;
}

function loadRlsOverrides(root: string): RlsOverride[] {
  const p = join(root, "tooling/standards-gate/rls-equivalence-overrides.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8")) as RlsOverride[];
  } catch {
    return [];
  }
}

interface TenantTableCandidate {
  table: string;
  column: string;
}

/** A `CREATE TABLE` whose body carries an `account_id`/`tenant_id` NOT NULL column. */
function findTenantTableCandidates(sql: string): TenantTableCandidate[] {
  const out: TenantTableCandidate[] = [];
  const createRe =
    /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql))) {
    const table = m[1];
    const body = m[2] ?? "";
    const col = /\b(account_id|tenant_id)\b[^,\n]*\bNOT NULL\b/.exec(body);
    if (table && col) out.push({ table, column: col[1] as string });
  }
  return out;
}

function normWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Strips SQL line comments (`-- … ` to end of line) before any block-extraction regex runs. Real
 * migrations narrate design rationale in comments that themselves mention keywords like "GRANT" (e.g.
 * "the RLS block below is byte-identical to buildTenantPolicySql(...) minus its `GRANT … UPDATE,
 * DELETE`") — left in, a naive single-match regex anchors on that stray mention and its lazy
 * `[\s\S]+?` then spans forward across unrelated CREATE TABLE/comment text to the first real
 * `ON <table> TO <role>;` it can find, capturing garbage as the "grant clause". Comments carry no RLS
 * semantics, so dropping them before parsing is correct, not lossy.
 */
function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

interface RlsBlock {
  enable: string;
  force: string;
  grantVerbs: string[];
  grantRole: string;
  using: string;
  withCheck: string;
}

/**
 * Regex-extracts a table's RLS wiring (ENABLE, FORCE, GRANT verb-set+role, USING/WITH-CHECK) from
 * `sql`. Returns `null` if any piece is absent — the block was never found (`rls-missing`). GRANT
 * and CREATE POLICY are matched independently (not required to be textually adjacent), so a REVOKE
 * statement sitting between them (the append-only tables' belt-and-suspenders pattern) never breaks
 * the match. Run on both the hand-written migration SQL and the generator's own rendered output, so
 * the two sides compare on identically-parsed fields.
 *
 * `sql` is a whole (possibly multi-table, multi-migration-file) concatenation — a package's
 * migrations commonly wire RLS for several tenant tables one after another. The GRANT search is
 * therefore bounded to the span between THIS table's own ENABLE line and its own LATEST CREATE
 * POLICY block: unbounded, a lazy `GRANT\s+([\s\S]+?)\s+ON\s+${table}\s+TO…` would latch onto an
 * EARLIER table's real GRANT statement (or a REVOKE) and span forward across unrelated SQL to reach
 * this table's `ON <table> TO <role>;`, silently attributing the wrong privilege set to this table.
 *
 * The CREATE POLICY match takes the LAST occurrence in `sql`, not the first: a policy hardening
 * follow-up (ADR-0006 append-only — a shipped migration's RLS predicate is never edited in place,
 * only re-issued via `DROP POLICY … ; CREATE POLICY …` in a later migration file) re-emits the same
 * `<table>_tenant_isolation` policy name later in the concatenated sequence. The effective policy is
 * whichever one Postgres applies LAST, so equivalence must be checked against that one, not the
 * table's original (now-superseded) definition.
 */
function extractRlsBlock(sql: string, table: string): RlsBlock | null {
  const enableM = new RegExp(
    String.raw`ALTER TABLE\s+${table}\s+ENABLE ROW LEVEL SECURITY\s*;`,
  ).exec(sql);
  const forceM = new RegExp(
    String.raw`ALTER TABLE\s+${table}\s+FORCE ROW LEVEL SECURITY\s*;`,
  ).exec(sql);
  const policyRe = new RegExp(
    String.raw`CREATE POLICY\s+${table}_tenant_isolation\s+ON\s+${table}\s*` +
      String.raw`USING\s*\(([\s\S]*?)\)\s*WITH CHECK\s*\(([\s\S]*?)\)\s*;`,
    "g",
  );
  let policyM: RegExpExecArray | null = null;
  for (let m = policyRe.exec(sql); m; m = policyRe.exec(sql)) {
    policyM = m;
  }
  if (!enableM || !forceM || !policyM) return null;

  const windowStart = Math.min(enableM.index, forceM.index);
  const window = sql.slice(windowStart, policyM.index);
  const grantM = new RegExp(
    String.raw`GRANT\s+([\s\S]+?)\s+ON\s+${table}\s+TO\s+(\w+)\s*;`,
  ).exec(window);
  if (!grantM) return null;

  const grantVerbs = (grantM[1] ?? "")
    .split(",")
    .map((v) =>
      v
        .trim()
        .replace(/\s*\([^)]*\)\s*$/, "")
        .toUpperCase(),
    )
    .filter((v) => v.length > 0);

  return {
    enable: normWhitespace(enableM[0]),
    force: normWhitespace(forceM[0]),
    grantVerbs,
    grantRole: grantM[2] ?? "",
    using: normWhitespace(policyM[1] ?? ""),
    withCheck: normWhitespace(policyM[2] ?? ""),
  };
}

export async function checkRlsEquivalence(
  pkgs: Pkg[],
  root: string,
): Promise<Finding[]> {
  // The REAL generator (SPEC-tenancy-rls task 3): gate and generator can't independently drift.
  // Lazily imported — a STATIC workspace import would break the CLI's pre-install fs-only pass
  // (CI layer 1a runs before `bun install`; @caisson/tenancy-rls itself imports @caisson/kernel).
  // Mirrors checkManifestAgreement's convention: a resolution failure is a non-blocking warn (the
  // post-install layer-1b run executes the check for real); any other load failure fails closed.
  let buildTenantPolicySql: typeof BuildTenantPolicySqlFn;
  try {
    ({ buildTenantPolicySql } = await import("@caisson/tenancy-rls"));
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const isResolutionFailure =
      (e as { code?: string }).code === "ERR_MODULE_NOT_FOUND" ||
      /cannot find (module|package)|failed to resolve/i.test(msg);
    return [
      {
        severity: isResolutionFailure ? "warn" : "error",
        rule: "rls-equivalence",
        pkg: "@caisson/tenancy-rls",
        message: isResolutionFailure
          ? `could not RESOLVE @caisson/tenancy-rls (${msg}) — RLS equivalence check skipped; CI must run post-install.`
          : `@caisson/tenancy-rls failed to load (${msg}) — the RLS generator is broken (ADR-0005).`,
      },
    ];
  }
  const overrides = loadRlsOverrides(root);
  const findings: Finding[] = [];

  for (const p of pkgs) {
    const migrationsDir = join(p.dir, "src", "migrations");
    if (!existsSync(migrationsDir)) continue;
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    if (files.length === 0) continue;
    const sql = stripLineComments(
      files.map((f) => readFileSync(join(migrationsDir, f), "utf8")).join("\n"),
    );

    for (const { table, column } of findTenantTableCandidates(sql)) {
      const actual = extractRlsBlock(sql, table);
      if (!actual) {
        findings.push({
          severity: "error",
          rule: "rls-missing",
          pkg: p.name,
          message: `tenant table "${table}" (${column}) has no hand-written RLS block (ENABLE + FORCE ROW LEVEL SECURITY, a GRANT, and a CREATE POLICY ${table}_tenant_isolation) in ${p.name}'s migrations — every tenant table must ship fail-closed RLS (ADR-0005).`,
        });
        continue;
      }

      // The generator's own output, parsed by the SAME extractor — ties this gate to the real
      // template so the two can never independently drift (a change to buildTenantPolicySql's
      // shape changes what "clean" means here automatically).
      const generated = extractRlsBlock(
        buildTenantPolicySql(table, { column, role: "app" }),
        table,
      );
      if (!generated) {
        throw new Error(
          `internal: buildTenantPolicySql("${table}") output didn't match this gate's own RLS-block parser — regex/generator drift, fix extractRlsBlock.`,
        );
      }

      const structuralMismatches: string[] = [];
      if (actual.enable !== generated.enable)
        structuralMismatches.push("ENABLE");
      if (actual.force !== generated.force) structuralMismatches.push("FORCE");
      if (actual.using !== generated.using) structuralMismatches.push("USING");
      if (actual.withCheck !== generated.withCheck)
        structuralMismatches.push("WITH CHECK");
      if (actual.grantRole !== generated.grantRole)
        structuralMismatches.push(`GRANT role (got "${actual.grantRole}")`);

      if (structuralMismatches.length > 0) {
        findings.push({
          severity: "error",
          rule: "rls-equivalence",
          pkg: p.name,
          message: `tenant table "${table}" RLS diverges from buildTenantPolicySql("${table}", { column: "${column}" }): ${structuralMismatches.join(", ")} don't whitespace-normalize-match the generated form (ADR-0005).`,
        });
        continue;
      }

      const fullCrud = generated.grantVerbs;
      const actualSet = new Set(actual.grantVerbs);
      const isExactMatch =
        actual.grantVerbs.length === fullCrud.length &&
        fullCrud.every((v) => actualSet.has(v));
      if (isExactMatch) continue;

      const isSubset = actual.grantVerbs.every((v) => fullCrud.includes(v));
      if (!isSubset) {
        findings.push({
          severity: "error",
          rule: "rls-equivalence",
          pkg: p.name,
          message: `tenant table "${table}" GRANTs an unexpected privilege set (${actual.grantVerbs.join(", ")}) — expected a subset of the generated full-CRUD set (${fullCrud.join(", ")}) (ADR-0005).`,
        });
        continue;
      }

      const isOverridden = overrides.some(
        (o) => o.table === table && o.package === p.name,
      );
      if (!isOverridden) {
        findings.push({
          severity: "error",
          rule: "rls-equivalence",
          pkg: p.name,
          message: `tenant table "${table}" GRANTs a narrower-than-generated privilege set (${actual.grantVerbs.join(", ")} vs ${fullCrud.join(", ")}) with no listed reason — add {table: "${table}", package: "${p.name}", reason} to tooling/standards-gate/rls-equivalence-overrides.json if intentional (ADR-0005).`,
        });
      }
    }
  }

  return findings;
}

/**
 * Shipped-prose gate (`docs/shipped-source-quality-rubric.md`, ADR-0233 Fork E). A buyer who opens
 * a `packages/*` README/AGENTS/CHANGELOG, a `package.json` description, or a `.ts` comment must
 * see buyer-readable prose — no internal vocabulary, no bare ADR/issue-tracker citations. Only the
 * `oss-source`/`sold-source`/`buyer-runtime` surface is scanned; `tooling/`, `infra/`,
 * `apps/admin`, `registry/`, `tooling/`, `docs/`, `.github/`, `.changeset/`, and
 * `outputs/` are internal-only and exempt per the rubric.
 */
const PROSE_SCAN_DOC_FILES = ["README.md", "AGENTS.md", "CHANGELOG.md"];

/** True for a package/app dir this gate scans — the rubric's oss-source/sold-source/buyer-runtime class. */
function isProseScanTarget(relDir: string): boolean {
  if (relDir.startsWith("packages/")) return true;
  return relDir === "apps/site" || relDir === "services/license";
}

/**
 * Every physical line of every `//` and `/* … *\/` comment in `src`, each paired with its
 * 1-indexed line number — strings and code are never returned, so an exported symbol like
 * `parseWave` never trips the gate. Built on the same `ts.createScanner` this file already uses
 * for the copy-paste gate (comment trivia included this time — `skipTrivia: false`), not a
 * text-search heuristic, so a `//` inside a string literal is never mistaken for a comment.
 */
function extractCommentLines(src: string): { line: number; text: string }[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.JSX,
    src,
  );
  const out: { line: number; text: string }[] = [];
  let kind = scanner.scan();
  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    if (
      kind === ts.SyntaxKind.SingleLineCommentTrivia ||
      kind === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const startLine = src.slice(0, scanner.getTokenPos()).split("\n").length;
      const lines = scanner.getTokenText().split("\n");
      for (let i = 0; i < lines.length; i++) {
        out.push({ line: startLine + i, text: lines[i] ?? "" });
      }
    }
    kind = scanner.scan();
  }
  return out;
}

export function checkShippedProse(pkgs: Pkg[], root: string): Finding[] {
  const findings: Finding[] = [];

  const flagTerm = (
    pkgName: string,
    relFile: string,
    lineNo: number,
    line: string,
  ): void => {
    const m = INTERNAL_TERM.exec(line);
    if (!m) return;
    findings.push({
      severity: "error",
      rule: "shipped-prose",
      pkg: pkgName,
      message: `SS-1/SS-2/SS-4: internal term "${m[0]}" in ${relFile}:${lineNo} — shipped source must be buyer-readable.`,
    });
  };

  for (const p of pkgs) {
    const relDir = relative(root, p.dir).split(sep).join("/");
    if (!isProseScanTarget(relDir)) continue;

    for (const docFile of PROSE_SCAN_DOC_FILES) {
      const path = join(p.dir, docFile);
      if (!existsSync(path)) continue;
      const lines = readFileSync(path, "utf8").split("\n");
      const relFile = `${relDir}/${docFile}`;
      lines.forEach((line, i) => flagTerm(p.name, relFile, i + 1, line));
    }

    const pjPath = join(p.dir, "package.json");
    if (existsSync(pjPath)) {
      const relFile = `${relDir}/package.json`;
      let description: unknown;
      try {
        description = JSON.parse(readFileSync(pjPath, "utf8")).description;
      } catch {
        description = undefined; // malformed package.json is another gate's problem
      }
      if (typeof description === "string") {
        flagTerm(p.name, `${relFile} (description)`, 1, description);
        if (hasBareAdrInDescription(description)) {
          findings.push({
            severity: "error",
            rule: "shipped-prose",
            pkg: p.name,
            message: `SS-12: bare ADR citation in ${relFile} description — write a plain one-line capability statement (an id may follow parenthetically only after ≥4 plain-English words).`,
          });
        }
      }
    }

    const glob = new Bun.Glob("src/**/*.{ts,tsx}");
    for (const rel of glob.scanSync({ cwd: p.dir })) {
      const src = readFileSync(join(p.dir, rel), "utf8");
      const relFile = `${relDir}/${rel}`;
      for (const { line: lineNo, text } of extractCommentLines(src)) {
        flagTerm(p.name, relFile, lineNo, text);
        if (BARE_ADR.test(text)) {
          findings.push({
            severity: "error",
            rule: "shipped-prose",
            pkg: p.name,
            message: `SS-3: bare ADR citation in ${relFile}:${lineNo} — state the rule in plain terms; the id may follow parenthetically.`,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Changeset-source prose gate (operator fork lock: gate at PR time, no silent formatter). The
 * default changeset formatter (`.changeset/config.json` → `@changesets/cli/changelog`) inlines a
 * changeset's summary markdown VERBATIM into the bumped package's shipped CHANGELOG.md — whatever
 * an author types into a `.changeset/*.md` body ships to buyers unedited. Rather than silently
 * rewriting it at release time, this gate fails the PR the moment an internal-prose leak lands in
 * a changeset body, forcing the author to write buyer-readable prose up front.
 *
 * Frontmatter (the `--- \n "@caisson/x": patch \n ---` package/bump header) is exempt — only the
 * body below it is scanned. An empty changeset (no body) passes trivially. `README.md` and
 * `config.json` inside `.changeset/` are not summaries and are never scanned.
 */
const CHANGESET_LEAK_RULES: { rule: string; re: RegExp; label: string }[] = [
  // Shares the ADR-id shape with prose-regex.ts's ADR_ID_SOURCE (checkShippedProse/BARE_ADR) so
  // the two gates can never independently drift on what an ADR citation looks like — same
  // /\bADR-\d{4}\b/g pattern as before this share, unconditional here (a changeset body allows NO
  // ADR mention at all, stricter than checkShippedProse's parenthetical-after-4-words allowance).
  {
    rule: "changeset-prose-adr",
    re: new RegExp(`\\b${ADR_ID_SOURCE}\\b`, "g"),
    label: "ADR citation",
  },
  {
    rule: "changeset-prose-wave",
    re: /\bwave-?6\w*/gi,
    label: "internal wave label",
  },
  {
    rule: "changeset-prose-row",
    re: /\brows?\s*#?\d+\b/gi,
    label: "row-number jargon",
  },
  {
    rule: "changeset-prose-path",
    re: /\b(?:docs\/(?:state|archive|ops)|outputs|knowledge)\//g,
    label: "internal repo path",
  },
  {
    rule: "changeset-prose-slug",
    re: /\bgw-[a-z-]+\b/gi,
    label: "session/agent slug",
  },
];

/**
 * Strips a changeset's YAML frontmatter (the leading `---`…`---` package/bump block) and returns
 * the remaining body plus the 1-indexed line number the body's first line sits at in the original
 * file — so a Finding can cite the real file line, not a body-relative offset. A malformed/absent
 * frontmatter (no leading `---`, or an unterminated one) falls back to scanning the whole file: the
 * changeset format always opens with frontmatter, so a missing close is corrupt input, not a
 * license to skip scanning it.
 */
function stripChangesetFrontmatter(content: string): {
  body: string;
  startLine: number;
} {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return { body: content, startLine: 1 };
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (closeIdx === -1) return { body: content, startLine: 1 };
  return {
    body: lines.slice(closeIdx + 1).join("\n"),
    startLine: closeIdx + 2,
  };
}

export function checkChangesetProse(root: string): Finding[] {
  const dir = join(root, ".changeset");
  if (!existsSync(dir)) return [];
  const findings: Finding[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".md") || entry === "README.md") continue;
    const relPath = `.changeset/${entry}`;
    const content = readFileSync(join(dir, entry), "utf8");
    const { body, startLine } = stripChangesetFrontmatter(content);
    const bodyLines = body.split("\n");
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i] ?? "";
      for (const { rule, re, label } of CHANGESET_LEAK_RULES) {
        re.lastIndex = 0; // stateful global regex — reset before every line/rule reuse
        const m = re.exec(line);
        if (!m) continue;
        findings.push({
          severity: "error",
          rule,
          pkg: "(changeset)",
          message: `${relPath}:${startLine + i}: ${label} "${m[0]}" — a changeset body ships verbatim into the bumped package's CHANGELOG; rewrite in buyer-readable prose.`,
        });
      }
    }
  }
  return findings;
}

/**
 * Entitlement-token scan (P0 audit remediation). A real license token is itself the leak — the
 * token IS the entitlement, and offline Ed25519 verify has no revocation list — so NO prod-signed
 * token may live under the paths that ship in fixtures, demos, or the public mirror. DEV-keypair
 * tokens are exempt: they are signed by the DOCUMENTED test seed
 * (SHA-256("caisson-license-verify-KAT-seed-v1")), carry no entitlement, and verify here by
 * reconstruction. ponytail: a regex walk over two directory globs + one Ed25519 check is the whole
 * gate — no pattern DB, no semgrep.
 */
// Match the VERIFIER's wire grammar, not the brand: decodeToken accepts ANY uppercase
// PREFIX-TIER, and the cosmetic prefix is never trusted — so the scan must not pin `CAISSON-`
// (a re-encoded real token under another prefix would still verify to pro).
const ENTITLEMENT_TOKEN_SHAPE = /\b[A-Z0-9]+-[A-Z0-9]+-[A-Za-z0-9_-]{88,}/g;

export function checkEntitlementTokenScan(root: string): Finding[] {
  // Derive the dev PUBLIC key via the private half (same pattern as the license-verify tests —
  // `createPublicKey`'s KeyObject overload is absent from bun-types).
  const devKey = createPublicKey(
    createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        createHash("sha256")
          .update("caisson-license-verify-KAT-seed-v1")
          .digest(),
      ]),
      format: "der",
      type: "pkcs8",
    }).export({ format: "pem", type: "pkcs8" }),
  );
  const isDevSigned = (token: string): boolean => {
    // Split on the SECOND hyphen (PREFIX-TIER-body), whatever the prefix length.
    const bodyB64 = token.slice(token.indexOf("-", token.indexOf("-") + 1) + 1);
    const body = Buffer.from(bodyB64, "base64url");
    // base64url decode is lenient; require the canonical round-trip (mirrors decodeToken) so a
    // mutated-but-decodes-same string is never exempted on the strength of the original signature.
    if (body.toString("base64url") !== bodyB64) return false;
    if (body.length <= 64) return false;
    try {
      return cryptoVerify(
        null,
        body.subarray(0, body.length - 64),
        devKey,
        body.subarray(body.length - 64),
      );
    } catch {
      return false;
    }
  };

  const findings: Finding[] = [];
  const scanDir = (dir: string, label: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(abs, label);
        continue;
      }
      const content = readFileSync(abs, "utf8");
      for (const match of content.match(ENTITLEMENT_TOKEN_SHAPE) ?? []) {
        if (isDevSigned(match)) continue;
        findings.push({
          severity: "error",
          rule: "entitlement-token-scan",
          pkg: label,
          message: `${abs.slice(root.length + 1)}: license-token-shaped string that does NOT verify against the dev test keypair — a real entitlement token must never be committed (rotate the issuer key if one leaked).`,
        });
      }
    }
  };

  // The two shipping-surface globs: golden fixtures + reference-app demos.
  for (const group of ["packages", "apps"]) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const slug of readdirSync(base)) {
      scanDir(
        join(base, slug, group === "packages" ? "src/__golden__" : "app/demo"),
        `${group}/${slug}`,
      );
    }
  }
  // The registry Worker tree (PR #117 P1 follow-up): its tests historically committed a
  // PROD-signed fixture — now they mint dev-key tokens at runtime (worker/dev-license.ts), and
  // this scan keeps it that way. Whole-tree walk; the shape regex only fires on 88+ char
  // token-shaped strings, so index/tarball hashes and attestations never match.
  scanDir(join(root, "registry", "worker"), "registry/worker");
  return findings;
}
