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
import { createHash } from "node:crypto";
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

// A registry-module candidate is a `packages/` member. `apps/` are reference applications (the
// base/edition reference apps + the design studio) — never published to the registry, so they are
// not held to the module declaration rules (they still face the AGPL checks below).
const isModuleCandidate = (p: Pkg): boolean =>
  p.dir.includes("/packages/") || p.dir.includes("\\packages\\");

export interface Finding {
  severity: "error" | "warn";
  rule: string;
  pkg: string;
  message: string;
}

/**
 * DORMANT TRIPWIRE. Every package ships Apache-2.0, so there is NO AGPL/copyleft source in the
 * tree and Gate 1 and Gate 1b never fire by construction. They stay wired ON PURPOSE as a
 * standing tripwire — a re-introduced AGPL dependency (workspace OR external npm) MUST still
 * hard-fail CI. Do not delete: this is the guard that keeps copyleft out of the tree even though it
 * is dormant today.
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

/**
 * `packages/` members that are internal engineering plumbing and will NEVER enter the registry
 * index — each one's own package.json `description` already says so in prose; this set just makes
 * that an enforced, auditable fact instead of a manifest-pending warning nobody will ever clear.
 * NOT inferred from `private: true` — every entry here is a deliberate opt-in with its own one-line
 * rationale, so a real future module can't slip past `manifest-pending` by accident.
 */
const NEVER_PUBLISHED = new Set([
  // The private brand layer (glyphs/wordmark) — apps consume it directly, never a registry module.
  "@caisson/brand",
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

export const OPEN_LICENSE = "Apache-2.0";
export const LICENSE_HOLDER = "Caisson Software LLC";

/**
 * Every published (non-private) workspace package is Apache-2.0: package.json says so, and the
 * package ships an Apache LICENSE file naming the copyright holder. The "Apache License" check is
 * load-bearing — the retired commercial LICENSE also named the holder.
 */
export function checkOpenLicense(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (p.private) continue;
    const fail = (message: string) =>
      findings.push({
        severity: "error",
        rule: "open-license",
        pkg: p.name,
        message,
      });
    if (p.license !== OPEN_LICENSE)
      fail(
        `package.json license is ${p.license ?? "absent"}; every published package must be ${OPEN_LICENSE}.`,
      );
    const licenseFile = join(p.dir, "LICENSE");
    const text = existsSync(licenseFile)
      ? readFileSync(licenseFile, "utf8")
      : null;
    if (text === null) fail(`no LICENSE file next to package.json.`);
    else if (!text.includes("Apache License") || !text.includes(LICENSE_HOLDER))
      fail(`LICENSE is not the Apache License naming ${LICENSE_HOLDER}.`);
  }
  return findings;
}

/** Sales framing a published package's description or README may not carry: a paid tier, a price. */
const SALES_COPY: readonly RegExp[] = [/\bcommercial\b/i, /\$\d/];

/** Drop fenced blocks and inline code spans — a `$1` there is a SQL placeholder, not a price. */
function stripMarkdownCode(md: string): string {
  return md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

/**
 * Nothing is sold: every published (non-private) package's package.json `description` and prose
 * README must describe what the package does, never a commercial tier or a dollar price.
 */
export function checkNoSalesCopy(pkgs: Pkg[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of pkgs) {
    if (p.private) continue;
    const texts: { where: string; text: string }[] = [];
    const pjPath = join(p.dir, "package.json");
    if (existsSync(pjPath)) {
      const { description } = JSON.parse(readFileSync(pjPath, "utf8")) as {
        description?: unknown;
      };
      if (typeof description === "string")
        texts.push({ where: "package.json description", text: description });
    }
    const readme = join(p.dir, "README.md");
    if (existsSync(readme))
      texts.push({
        where: "README.md",
        text: stripMarkdownCode(readFileSync(readme, "utf8")),
      });
    for (const { where, text } of texts) {
      const hit = SALES_COPY.map((re) => re.exec(text)?.[0]).find(
        (m) => m !== undefined,
      );
      if (hit !== undefined)
        findings.push({
          severity: "error",
          rule: "no-sales-copy",
          pkg: p.name,
          message: `${where} says "${hit}" — every package is ${OPEN_LICENSE} and nothing is sold; describe what the package does.`,
        });
    }
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

/** True for a package/app dir this gate scans — the published packages plus the public site. */
function isProseScanTarget(relDir: string): boolean {
  if (relDir.startsWith("packages/")) return true;
  return relDir === "apps/site";
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
