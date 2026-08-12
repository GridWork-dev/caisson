#!/usr/bin/env bun
/**
 * export-public-mirror.ts — build the PUBLIC MIRROR repo content.
 *
 * Selects every Apache-2.0 `packages/*` (plus the build/test tooling they need to install and run
 * standalone) and copies them into an output dir as a self-contained Bun workspace, optimized as a
 * GTM / acquisition surface (the public front door on GitHub).
 *
 * The public npm scope `@caisson` is owned by a third party; the operator publishes the open set as
 * `@caisson-sh/*`. This exporter therefore renames the scope of every exported package and every
 * cross-reference to it — npm NAMES only (package.json name/deps + import/require specifiers). The
 * registry's `@caisson/<slug>` PRODUCT / module-id string literals (registry-schema data, golden
 * fixtures) are a distinct namespace served by the commercial registry at caisson.sh and are left
 * intact — the import-specifier-scoped rename never touches them.
 *
 * FAILS LOUDLY (nonzero exit) if any selected package depends on a commercial package — the open set
 * MUST be self-contained. The standards-gate no-depend-up boundary guarantees this; we verify it.
 *
 *   bun scripts/export-public-mirror.ts --out mirror-out --generated-at 2026-07-02
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { buildShadcnRegistry } from "./gen-shadcn-registry.ts";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

const APACHE = "Apache-2.0";
const COMMERCIAL = "LicenseRef-Caisson-Commercial";
const SOURCE_REPO = "caisson-sh/caisson";
const OLD_SCOPE = "@caisson/";
const NEW_SCOPE = "@caisson-sh/";

export const MIRROR_WORKSPACES = {
  packages: ["packages/*", "tooling/*"],
} as const;

/** Tooling packages the Apache set needs to install / build / test / lint standalone. Restamped
 *  Apache-2.0 in the mirror — internal scaffolding with no commercial IP (a strict tsconfig base,
 *  the shared eslint config, and the PGlite RLS / golden-file test harness). Shipping them keeps the
 *  packages faithful (unmodified) and the `@caisson/kernel` standards gate green. */
const BUILD_SUPPORT = new Set([
  "@caisson/tsconfig",
  "@caisson/eslint-config",
  "@caisson/testing",
]);

/** Test files that cannot pass in the open mirror. Repo-relative source paths, excluded from copy.
 *  Each with the reason it is inherently coupled to the private monorepo. */
export const EXCLUDE_TEST_FILES: ReadonlyMap<string, string> = new Map([
  [
    "packages/cli/scripts/bundle-migrations.test.ts",
    "bundles COMMERCIAL modules' migrations (field-crypto, audit-worm) — those packages are excluded from the open mirror",
  ],
  [
    "packages/kernel/src/gate.test.ts",
    "asserts the private monorepo's @caisson/-scope + full-tooling-composition invariant, which the @caisson-sh/ scope-renamed open mirror intentionally diverges from",
  ],
  [
    "tooling/eslint-config/boundaries.test.ts",
    "eslint-driven boundary test lints the COMMERCIAL @caisson/ai-kit provider fixture (PROVIDER_EXEMPT carve-out); ai-kit is excluded from the open mirror",
  ],
  [
    "packages/cli/src/sample-templates.test.ts",
    "materializes + EXECUTES the free eu-ai-act sample by reading its template files from disk at runtime. rewriteCliTemplates rewrites those on-disk template files to @caisson-sh/kernel for the mirror, but this test's assertions are hardcoded to the pre-rewrite @caisson/kernel specifier (correct for the monorepo-native generator) and would fail if run against the rewritten mirror templates. The sample generator (sample-templates.ts) still ships.",
  ],
  [
    "packages/cli/src/meter.integration.test.ts",
    "exercises the debit-before-spend seam against the real COMMERCIAL @caisson/credits ledger (a dev-only fixture behind the DebitFn injection port); credits is excluded from the open mirror",
  ],
  [
    "packages/cli/src/generate.integration.test.ts",
    "exercises the buyer-MCP generation drive against the real COMMERCIAL @caisson/credits ledger; credits is excluded from the open mirror",
  ],
  [
    "packages/mcp-server/src/base-composition.integration.test.ts",
    "exercises the relocated base composition against COMMERCIAL @caisson/credits and @caisson/billing-orchestration fixtures; both packages are excluded from the open mirror",
  ],
  [
    "packages/cli/src/run.test.ts",
    "imports TrajectoryEvent directly from the COMMERCIAL @caisson/agent-trajectory package (shape-parity assertion) and reads its migration SQL files by relative path; agent-trajectory is excluded from the open mirror. run.ts itself (still shipped) only references agent-trajectory in comments and hand-mirrors its schema via raw SQL by design (ADR-0094/0097 open/commercial boundary) — it stays mirror-safe. Sibling run-start.test.ts imports only @caisson/mcp-server + @caisson/registry-schema (both open) and ships unexcluded.",
  ],
  [
    "packages/registry-schema/src/entitlement-expansion.test.ts",
    "reads the repo-root registry/index.json fixture, which does not ship in the mirror (W1 sandbox finding L-A1: ENOENT failed the mirror's own `bun run test`)",
  ],
  [
    "packages/cli/scripts/bundle-registry-index.test.ts",
    "reads the repo-root registry/index.json (via SOURCE_INDEX), which does not ship in the mirror — same class as the registry-schema entitlement-expansion exclusion above (ENOENT fails the mirror's own `bun test`)",
  ],
  [
    "packages/registry-schema/src/bundle-manifests.test.ts",
    "dynamically imports the COMMERCIAL bundle packages' manifest.ts files (provenance, ai-production, local-first, agentic-dev, everything) — none exist in the open mirror (W1 sandbox finding L-A2)",
  ],
  [
    "packages/cli/src/cli.test.ts",
    "its end-to-end describe block loads the repo-root registry/index.json (the CI-built private-monorepo artifact), which does not ship in the mirror — three e2e tests ENOENT/exit-1 there (W1 sandbox re-validation). The argv/TTY/sample coverage stays enforced in the private repo on every commit.",
  ],
  [
    "packages/cli/src/framework-next.compose.test.ts",
    "the exit gate typechecks the generated Next tree against @caisson/* base packages resolved from cli's node_modules — the mirror installs those under the renamed @caisson-sh/* scope, so resolution fails by construction (the generated tree's @caisson/* imports are buyer-registry namespace, correctly left unrenamed). Enforced in the private repo (W1 sandbox re-validation).",
  ],
]);

/** Commercial devDependencies stripped from a mirrored package.json (keyed by ORIGINAL @caisson
 *  name). The dep's only consumers are test files excluded above, so the mirrored package is
 *  self-contained without it — the self-containment gate below skips exactly these pairs. */
export const DROP_COMMERCIAL_DEV_DEPS: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map([
  ["@caisson/cli", new Set(["@caisson/credits", "@caisson/agent-trajectory"])],
  [
    "@caisson/mcp-server",
    new Set(["@caisson/billing-orchestration", "@caisson/credits"]),
  ],
]);

/** Packages whose `test` script is dropped in the mirror (their only test is excluded above, so
 *  turbo skips the package rather than erroring on a now-empty glob). */
const DROP_TEST_SCRIPT = new Set(["@caisson/eslint-config"]);

/** Test-script overrides (keyed by ORIGINAL @caisson name) for packages whose default glob would
 *  hit an excluded test file. cli's `bun test ./src ./scripts` loses ./scripts once bundle-migrations
 *  is excluded (no other ./scripts test). */
const TEST_SCRIPT_OVERRIDES: Readonly<Record<string, string>> = {
  "@caisson/cli": "bun test ./src",
};

/** Build-script overrides (keyed by ORIGINAL @caisson name). cli's real build bundles COMMERCIAL
 *  module migrations into a runtime artifact; that step is meaningless (and empty) in the open
 *  mirror, so the mirror build only typechecks + emits + shebangs. */
const BUILD_SCRIPT_OVERRIDES: Readonly<Record<string, string>> = {
  "@caisson/cli":
    "tsc -p tsconfig.json && tsc -p tsconfig.scripts.json && bun run scripts/add-shebang.ts",
};

interface CatalogConfig {
  readonly catalog: Record<string, string>;
  readonly catalogs?: Record<string, Record<string, string>>;
}

/** Resolve a `catalog:` / `catalog:<name>` dependency specifier to its concrete semver range from
 *  the root workspace catalog (`bun catalogs`, ADR-program row #4). The mirror is a standalone Bun
 *  workspace with no root catalog of its own — a `"catalog:"` string shipped in a buyer's
 *  package.json would break `bun install` outright. Non-catalog specifiers pass through unchanged.
 *  Fails loud (throws) on an unresolvable reference rather than shipping a broken specifier. */
export function resolveCatalogSpec(
  depName: string,
  spec: string,
  { catalog, catalogs }: CatalogConfig,
): string {
  if (!spec.startsWith("catalog:")) return spec;
  const catalogName = spec.slice("catalog:".length);
  const table = catalogName === "" ? catalog : catalogs?.[catalogName];
  const resolved = table?.[depName];
  if (!resolved) {
    throw new Error(
      `Unresolvable catalog specifier "${spec}" for dependency "${depName}" — no matching entry in the root workspace catalog${catalogName ? ` "${catalogName}"` : ""}.`,
    );
  }
  return resolved;
}

interface PkgJson {
  readonly name: string;
  readonly version: string;
  readonly license?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly [k: string]: unknown;
}

interface FoundPkg {
  readonly json: PkgJson;
  readonly group: "packages" | "tooling";
  readonly slug: string; // directory basename
  readonly dir: string; // absolute source dir
}

function parseArgs(argv: readonly string[]): {
  out: string;
  generatedAt: string;
  allowMissingExcludes: boolean;
} {
  let out = "./mirror-out";
  let generatedAt = "";
  // Historical-backfill escape hatch for the missing-excluded-test rot-guard. An EXPLICIT CLI flag,
  // never an ambient env var: a sticky `CAISSON_MIRROR_ALLOW_MISSING_EXCLUDES=1` in an operator
  // shell would silently downgrade the FATAL to a warning on a later HEAD/CI sync, letting a renamed
  // excluded test re-enter the mirror. A flag applies only to the run that passes it.
  let allowMissingExcludes = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out = argv[++i] ?? out;
    else if (a === "--generated-at") generatedAt = argv[++i] ?? "";
    else if (a === "--allow-missing-excludes") allowMissingExcludes = true;
  }
  if (!generatedAt) {
    console.error(
      "FATAL: --generated-at <iso-date> is required (the caller passes it; Date.now is fine in repo scripts).",
    );
    process.exit(1);
  }
  return { out, generatedAt, allowMissingExcludes };
}

export function resolveMirrorOutDir(repoRoot: string, output: string): string {
  const allowedRoot = resolve(repoRoot, "mirror-out");
  const outDir = resolve(repoRoot, output);
  if (
    output.includes("\0") ||
    isAbsolute(output) ||
    output.split(/[\\/]/).includes("..") ||
    (outDir !== allowedRoot && !outDir.startsWith(`${allowedRoot}${sep}`))
  ) {
    throw new Error(
      "mirror output must stay inside the dedicated mirror-out directory",
    );
  }
  return outDir;
}

export function assertMirrorOutDirHasNoSymlinkAncestors(
  allowedRoot: string,
  outDir: string,
): void {
  let current = outDir;
  while (true) {
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error("mirror output path must not contain symlinks");
    }
    if (current === allowedRoot) return;
    const parent = dirname(current);
    if (parent === current) {
      throw new Error("mirror output path must stay inside the allowed root");
    }
    current = parent;
  }
}

function readJson(path: string): PkgJson {
  return JSON.parse(readFileSync(path, "utf8")) as PkgJson;
}

function scanGroup(root: string, group: "packages" | "tooling"): FoundPkg[] {
  const base = join(root, group);
  if (!existsSync(base)) return [];
  const out: FoundPkg[] = [];
  for (const slug of readdirSync(base)) {
    const dir = join(base, slug);
    const pj = join(dir, "package.json");
    if (existsSync(pj)) out.push({ json: readJson(pj), group, slug, dir });
  }
  return out;
}

function internalDeps(
  json: PkgJson,
  key: "dependencies" | "devDependencies" | "peerDependencies",
): string[] {
  return Object.keys(json[key] ?? {}).filter((n) => n.startsWith(OLD_SCOPE));
}

const renameScope = (name: string): string =>
  name.startsWith(OLD_SCOPE) ? NEW_SCOPE + name.slice(OLD_SCOPE.length) : name;

/** Rewrite `@caisson/x` → `@caisson-sh/x` ONLY inside import / export-from / dynamic-import /
 *  require specifiers. Bare `"@caisson/x"` string literals (registry module-ids, product ids) and
 *  the `/^@caisson\/…$/` validation regex are never in this position, so they are left intact. */
function rewriteImportSpecifiers(code: string): string {
  return code.replace(
    /(\bfrom|\bimport|\brequire)(\s*\(?\s*)(["'])@caisson\/([^"']+)\3/g,
    (_m, kw, gap, q, spec) => `${kw}${gap}${q}${NEW_SCOPE}${spec}${q}`,
  );
}

/** Rewrite bare `@caisson/<slug>` mentions → `@caisson-sh/<slug>` — but ONLY for slugs in the
 *  exported open set. Broader than `rewriteImportSpecifiers`'s import/require-keyword guard; used
 *  for doc prose (README/CHANGELOG/AGENTS.md bodies, task 3.1) where a scope mention is never in
 *  import position. Scope-aware since the W1 sandbox docs audit (2026-07-10): the old blanket
 *  rename also converted COMMERCIAL product mentions (`@caisson/compliance`, `@caisson/credits`,
 *  `@caisson/ai-kit`, registry `--module` ids) into `@caisson-sh/*` names that will never exist on
 *  public npm — materially misleading a mirror reader. A commercial mention stays `@caisson/*`,
 *  which is exactly the namespace the commercial registry serves. */
export function rewriteProseMentions(
  text: string,
  openSlugs: ReadonlySet<string>,
): string {
  // Slugs are kebab-case `[\w-]+` (no internal dots — verified across the catalog). A `.` in the
  // class swallowed a trailing sentence period (`@caisson/kernel.` → rest `kernel.`), missing the
  // openSlugs allowlist and shipping the mention UN-renamed at `@caisson/*` (third-party on public
  // npm). Excluding `.` stops the capture at the slug so the period stays as prose punctuation.
  return text.replace(/@caisson\/([\w-]+)/g, (m, rest: string) =>
    openSlugs.has(rest) ? `${NEW_SCOPE}${rest}` : m,
  );
}

const SRC_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);
// Directories whose contents are DATA, not the mirror package's own buildable source — their
// `@caisson/` specifiers are the buyer repo's future imports (served by the commercial registry) and
// must stay `@caisson/`. Skipped for the import rewrite.
const REWRITE_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "templates",
  "__golden__",
  "__fixtures__",
]);

// --- entitlement-token gate (P0 audit remediation) ---------------------------------------------
// A real entitlement token is itself the leak: the token IS the entitlement, and offline Ed25519
// verify has no revocation list — private-key secrecy is irrelevant. NO prod-signed token may ever
// ship in the mirror. DEV-keypair tokens are exempt: they are signed by the DOCUMENTED test seed
// (SHA-256("caisson-license-verify-KAT-seed-v1")), carry no entitlement, and verify here by
// reconstruction. ponytail: a regex walk + one Ed25519 check is the whole gate — no pattern DB.
// Match the VERIFIER's wire grammar, not the brand: decodeToken accepts ANY uppercase
// PREFIX-TIER and never trusts the cosmetic prefix — so the scan must not pin `CAISSON-`.
const TOKEN_SHAPE = /\b[A-Z0-9]+-[A-Z0-9]+-[A-Za-z0-9_-]{88,}/g;
const DEV_VERIFY_KEY = createPublicKey(
  createPrivateKey({
    key: Buffer.concat([
      // Ed25519 PKCS#8 DER prefix ‖ the documented dev test-vector seed (never a production secret).
      Buffer.from("302e020100300506032b657004220420", "hex"),
      createHash("sha256")
        .update("caisson-license-verify-KAT-seed-v1")
        .digest(),
    ]),
    format: "der",
    type: "pkcs8",
  }).export({ format: "pem", type: "pkcs8" }),
);

/** True iff the token's 64-byte signature tail verifies against the DEV public key. */
function isDevSigned(token: string): boolean {
  // Split on the SECOND hyphen (PREFIX-TIER-body), whatever the prefix length.
  const bodyB64 = token.slice(token.indexOf("-", token.indexOf("-") + 1) + 1);
  const body = Buffer.from(bodyB64, "base64url");
  // base64url decode is lenient; require the canonical round-trip (mirrors decodeToken) so a
  // mutated-but-decodes-same string is never exempted on the strength of the original signature.
  if (body.toString("base64url") !== bodyB64) return false;
  if (body.length <= 64) return false;
  const payload = body.subarray(0, body.length - 64);
  const signature = body.subarray(body.length - 64);
  try {
    return cryptoVerify(null, payload, DEV_VERIFY_KEY, signature);
  } catch {
    return false;
  }
}

/** Scan every text file in the mirror out-dir for non-dev license tokens; FATAL on any hit. */
function scanForEntitlementTokens(dir: string, hits: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") scanForEntitlementTokens(abs, hits);
      continue;
    }
    const content = readFileSync(abs, "utf8");
    for (const match of content.match(TOKEN_SHAPE) ?? []) {
      if (!isDevSigned(match)) hits.push(`${abs}: ${match.slice(0, 24)}...`);
    }
  }
}

/**
 * Internal references that must never reach the public mirror, each paired with what a public
 * reader actually experiences when they hit one. These are NOT secrets — the entitlement-token
 * gate above covers that class. These are dead ends: strings that were meaningful inside a private
 * monorepo and become unresolvable noise the moment the tree is published.
 *
 * The ADR rule is the reason this gate exists at all. `sanitizeAdrCitations` strips only a
 * parenthetical whose ENTIRE content is ADR ids, which left 862 citations across 231 files in the
 * export — "(ADR-0021 §golden)", "the ADR-0013 harness", "(ADR-0042 design foundation)" — every one
 * of them pointing at a decision log the reader cannot open. Stripping is `stripAdrIds`; this gate
 * is what proves the stripping was COMPLETE, on every future sync, rather than trusting a regex
 * pass to have caught every shape.
 */
const INTERNAL_REFERENCE_RULES: ReadonlyArray<{
  re: RegExp;
  why: string;
}> = [
  {
    re: /\bADR-\d{3,4}\b/g,
    why: "internal decision-log id — the corpus is private, so the citation resolves to nothing",
  },
  {
    re: /\b(?:outputs|knowledge)\/(?:specs|plans|decisions)\//g,
    why: "internal doc tree — that path does not exist in the mirror",
  },
  {
    re: /\bdocs\/state\//g,
    why: "internal state-doc tree — that path does not exist in the mirror",
  },
  {
    re: /\bcaisson-sh\/caisson\b(?!-oss)/g,
    why: "the PRIVATE development repo — 404s for every anonymous reader",
  },
];

/**
 * Scan every text file in the mirror out-dir for internal references; FATAL on any hit.
 *
 * MIRROR-MANIFEST.json is exempt from the private-repo rule only: it records the source repo and
 * commit the export was cut from, which is provenance a mirror consumer legitimately wants (and
 * the repo being private is not itself a secret). Every other rule still applies to it.
 */
function scanForInternalReferences(dir: string, hits: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git")
        scanForInternalReferences(abs, hits);
      continue;
    }
    if (entry.name === "bun.lock") continue;
    const isManifest = entry.name === "MIRROR-MANIFEST.json";
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue; // binary / unreadable — nothing to match
    }
    for (const rule of INTERNAL_REFERENCE_RULES) {
      if (isManifest && rule.why.startsWith("the PRIVATE development repo"))
        continue;
      for (const match of content.match(rule.re) ?? []) {
        hits.push(`${abs}: ${match} — ${rule.why}`);
      }
    }
  }
}

function rewriteImportsInTree(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!REWRITE_SKIP_DIRS.has(entry.name)) rewriteImportsInTree(abs);
      continue;
    }
    const dot = entry.name.lastIndexOf(".");
    if (dot < 0 || !SRC_EXT.has(entry.name.slice(dot))) continue;
    const before = readFileSync(abs, "utf8");
    const after = sanitizeSourceComments(rewriteImportSpecifiers(before));
    if (after !== before) writeFileSync(abs, after);
  }
}

/** Rewrite `extends` (and any other tooling ref) in package-root tsconfig*.json — these reference
 *  the renamed tooling packages by npm name but are neither import specifiers nor package.json deps.
 *  Package-root only (never recurses into `templates/`, whose tsconfigs are buyer-repo data).
 *  Filename match also covers `base.json` (`tooling/tsconfig/base.json` — the base itself, not a
 *  consumer's `tsconfig.json`); the content regex has no trailing-slash requirement, so it catches
 *  both a slash-terminated `"extends"` ref AND `base.json`'s human-readable `"display": "@caisson/
 *  tsconfig base"` field (task 3.3, finding c018d53b61e0d0d7). */
function rewriteTsconfigRefs(pkgDir: string): void {
  for (const entry of readdirSync(pkgDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^(tsconfig.*|base)\.json$/.test(entry.name))
      continue;
    const abs = join(pkgDir, entry.name);
    const before = readFileSync(abs, "utf8");
    const after = before.replace(
      /@caisson\/(tsconfig|eslint-config|testing)/g,
      `${NEW_SCOPE}$1`,
    );
    if (after !== before) writeFileSync(abs, after);
  }
}

/** Task 3.1 (findings d88c2d9030c9e5e4 + 98c91a4cca39fec1): the import-specifier rewrite only
 *  touches import/require statements — it never sanitizes bare scope mentions in doc prose (a
 *  CHANGELOG "Updated dependencies" entry, a README title/body). Run per package, over just these
 *  three well-known doc files at the package root — never recurses (a package's own docs, not its
 *  templates/fixtures data, which stay governed by `REWRITE_SKIP_DIRS`). */
const PACKAGE_PROSE_FILES = ["README.md", "CHANGELOG.md", "AGENTS.md"];

/** GTM / community-health assets copied verbatim from scripts/mirror-assets/ into every export.
 *  `dest` is relative to outDir; `src` is relative to scripts/mirror-assets/. A pure data table
 *  (rather than inline cpSync calls) so export-public-mirror.test.ts can pin that a new asset is
 *  actually wired in without running the full export. */
export const MIRROR_ASSET_FILES: ReadonlyArray<{
  readonly src: string;
  readonly dest: string;
}> = [
  { src: "README.md", dest: "README.md" },
  { src: "CONTRIBUTING.md", dest: "CONTRIBUTING.md" },
  { src: "TRADEMARK.md", dest: "TRADEMARK.md" },
  { src: "SECURITY.md", dest: "SECURITY.md" },
  { src: "SUPPORT.md", dest: "SUPPORT.md" },
  { src: "CODE_OF_CONDUCT.md", dest: "CODE_OF_CONDUCT.md" },
  { src: "eslint.config.js", dest: "eslint.config.js" },
  { src: ".prettierignore", dest: ".prettierignore" },
  { src: "ci.yml", dest: ".github/workflows/ci.yml" },
  { src: "publish.yml", dest: ".github/workflows/publish.yml" },
  {
    src: "ISSUE_TEMPLATE/bug_report.md",
    dest: ".github/ISSUE_TEMPLATE/bug_report.md",
  },
];

/** Findings 6efc5c3da5addb5a / 7023e53bc240b60f / a7f243986de1287f: README/CHANGELOG/AGENTS.md
 *  prose and source comments across the mirror cite bare internal ADR decision-log ids in
 *  parentheticals — e.g. "(ADR-0175)", "(ADR-0134/0101)", "(P6, ADR-0089/0017)" — unresolvable to
 *  a buyer with no access to that corpus. A parenthetical is stripped only when its ENTIRE content
 *  is ADR-id tokens (optionally alongside a short internal phase/wave shorthand code like "P6");
 *  a parenthetical that mixes real prose with an ADR id — e.g. "(see ADR-0072 for details)" — is
 *  left untouched, since it reads as ordinary buyer-facing prose, not a bare citation. */
const ADR_TOKEN_RE = /^ADR-\d+$/;
const ADR_CONTINUATION_RE = /^\d+$/; // e.g. the "0101" in "(ADR-0134/0101)"
const SHORT_CODE_RE = /^[A-Za-z]{1,4}\d{0,3}$/; // e.g. "P6" in "(P6, ADR-0089)"

function isBareAdrParenthetical(content: string): boolean {
  const tokens = content
    .split(/[,/]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  let sawAdrToken = false;
  for (const token of tokens) {
    if (ADR_TOKEN_RE.test(token)) sawAdrToken = true;
    else if (!ADR_CONTINUATION_RE.test(token) && !SHORT_CODE_RE.test(token))
      return false;
  }
  return sawAdrToken;
}

/** Pure sanitizer: strips bare-ADR-id parentheticals from prose text and tidies the whitespace
 *  residue the strip itself leaves behind. Scoped to the removal site only — all cleanup happens
 *  inside the replace callback, which by construction only ever fires where a bare parenthetical
 *  was actually found, so it never touches whitespace/punctuation elsewhere in the document (a
 *  markdown list's indented continuation lines, or unrelated code like `crypto.randomUUID()` or
 *  `.strict()` sitting nearby). Two whole-document cleanup passes used to run here (`/\(\s*\)/g`
 *  and `/[ \t]+([.,;:])/g`) — they silently corrupted any real empty-parens call or
 *  space-before-punctuation ANYWHERE in the text, not just next to a stripped citation (e.g.
 *  `z.object().strict()` -> `z.object.strict`). Removed; the only real per-site residue (a single
 *  trailing space left stranded directly before punctuation, e.g. "(ADR-1) .") is now collapsed by
 *  peeking at just the one character after this match. Exported for unit testing. */
export function sanitizeAdrCitations(text: string): string {
  return text.replace(
    /[ \t]*\(([^()]*)\)([ \t]*)/g,
    (
      whole: string,
      content: string,
      trailingWs: string,
      offset: number,
      full: string,
    ) => {
      if (!isBareAdrParenthetical(content)) return whole;
      if (trailingWs.length === 0) return "";
      const next = full[offset + whole.length];
      return next !== undefined && /[.,;:]/.test(next) ? "" : " ";
    },
  );
}

/**
 * Removes EVERY remaining ADR id, in any shape, from a chunk of text. Runs after
 * `sanitizeAdrCitations` has taken the bare parentheticals; what is left is the harder half — ids
 * fused into prose ("the ADR-0013 harness"), ids leading a parenthetical that also carries real
 * words ("(ADR-0042 design foundation)"), and ids trailing a citation verb ("see ADR-0072 for
 * details"). The `scanForInternalReferences` gate is what proves this ran to completion; this
 * function only has to leave READABLE prose behind.
 *
 * Grammar is the whole difficulty. Deleting the id alone is right when the next word can absorb
 * the slot ("per ADR-0161 decision 1" → "per decision 1"), and wrong when a verb follows ("as
 * ADR-0005 requires" → "as requires"), so the verb case takes the citation phrase with it. Rules
 * run in order, most specific first.
 *
 * WHITESPACE IS ALWAYS REPAIRED INSIDE THE CALLBACK, never by a document-wide pass. A blanket
 * `/\(\s*\)/g` + `/[ \t]+([.,;:])/g` cleanup lived here once and silently rewrote real code
 * anywhere in the file — `z.object().strict()` became `z.object.strict` — because those patterns
 * match things that have nothing to do with a citation. Every repair below is scoped to the span
 * that actually matched.
 */
const ADR_IDS = String.raw`ADR-\d{3,4}(?:[ \t]*[/,][ \t]*(?:ADR-)?\d{3,4})*`;
/** An internal doc path, optionally carrying its "SPEC "/"PLAN " label — the same class of dead
 *  citation as an ADR id (`(SPEC outputs/specs/…/SPEC-foo.md, operator-locked 2026-07-10)`), so it
 *  rides the same paren-unit and inline machinery rather than getting its own bespoke pass. */
const INTERNAL_PATH = String.raw`(?:(?:SPEC|PLAN|ADR)\s+)?(?:outputs|knowledge)/(?:specs|plans|decisions)/\S+?\.md|(?:(?:SPEC|PLAN)\s+)?docs/state/\S+?\.md`;
/** Either flavour of dead citation, so both get the same verb absorption and gap repair. */
const CITATION = `${ADR_IDS}|${INTERNAL_PATH}`;
/** A citation carrying its own title as a trailing gloss: `ADR-0043 (per-tenant keys)`. */
const GLOSSED = String.raw`(?:${CITATION})[ \t]+\([^()\n]*\)`;
const HAS_ADR =
  /\bADR-\d{3,4}\b|(?:outputs|knowledge)\/(?:specs|plans|decisions)\/|docs\/state\//;

/**
 * True when a citation OPENED its line — only indentation and an optional comment marker precede
 * it. Such a citation is a label or a sentence of its own, so a `.`/`:` directly after it is the
 * citation's own punctuation and must go with it: "// ADR-0257: the bundle model" would otherwise
 * export as "//: the bundle model". Anywhere else the punctuation belongs to the host sentence.
 */
function ownsTrailingPunctuation(
  punctuation: string,
  full: string,
  offset: number,
): boolean {
  if (punctuation === "") return false;
  const lineHead = full.slice(full.lastIndexOf("\n", offset - 1) + 1, offset);
  return /^\s*(?:\/\/|\*|--|#)?\s*$/.test(lineHead);
}

/**
 * Whitespace repair for one removed citation span, decided ONLY from that span's own immediate
 * neighbours. Never leaves a stranded space before punctuation, at either end of the text, or
 * inside parens/brackets the removal just emptied — and collapses to exactly one space between two
 * words no matter how the citation was padded.
 */
function repairGap(
  before: string,
  after: string,
  prev: string | undefined,
  next: string | undefined,
): string {
  if (prev === undefined || prev === "(" || prev === "[") return "";
  // A newline or a closing quote is an end-of-text boundary too: a citation closing a line must not
  // leave the line with trailing whitespace (32 files in this corpus end a line on one), and one
  // closing a string literal must not leave a space inside the quotes. That second case is
  // load-bearing for `packages/ds-manifest/src/base-manifest.json`, whose summaries are generated
  // from the very JSDoc comments this function also rewrites: the generator collapses whitespace,
  // so a trailing space kept on the JSON side alone breaks its byte-identical golden test.
  if (next === undefined || /[.,;:)\]\r\n"'`]/.test(next)) return "";
  return before.length > 0 || after.length > 0 ? " " : "";
}

/** The rules below applied to a run of text, with no knowledge of enclosing parentheses. */
function stripAdrIdsInline(text: string): string {
  let out = text;
  // 0. A lock/date note that only made sense next to an internal doc path goes with it
  //    ("SPEC outputs/specs/x/SPEC-y.md, operator-locked 2026-07-10"). The path itself is left
  //    for rules 1 and 5 so it gets the same verb absorption and gap repair an ADR id gets.
  out = out.replace(
    new RegExp(
      String.raw`(${INTERNAL_PATH}),?[ \t]*operator-locked[ \t]+\d{4}-\d{2}-\d{2}`,
      "g",
    ),
    "$1",
  );
  // 0b. A parenthetical immediately after a citation is that citation's own gloss — the ADR's
  //     title, not a fact about the code — and these travel in `·`-separated runs as a README's
  //     closing provenance sentence ("stand on. ADR-0043 (per-tenant keys) · ADR-0046 (envelope)").
  //     Take the whole run, or the removal strands the titles as a sentence of their own. The run's
  //     period goes with it only when the run IS the sentence (it follows one, or opens the line).
  out = out.replace(
    new RegExp(
      String.raw`([ \t]*)(?:[-—,;·][ \t]*)?${GLOSSED}(?:[ \t]*[·,;][ \t]*${GLOSSED})*([.:]?)([ \t]*)`,
      "g",
    ),
    (
      whole: string,
      before: string,
      punctuation: string,
      after: string,
      offset: number,
      full: string,
    ) => {
      const prev = full[offset - 1];
      const owns =
        punctuation !== "" &&
        (prev === undefined ||
          prev === "." ||
          prev === "\n" ||
          ownsTrailingPunctuation(punctuation, full, offset));
      if (punctuation !== "" && !owns) return `${punctuation}${after}`;
      return repairGap(before, after, prev, full[offset + whole.length]);
    },
  );
  // 1. A citation verb owning the citation — the verb is meaningless once the citation goes.
  //    "(see ADR-0072 for details)" → "(for details)"; "Blacksmith per ADR-0365," → "Blacksmith,"
  out = out.replace(
    new RegExp(
      String.raw`([ \t]*)\b(?:see|per|cf\.?|ref\.?|refs?\.?)[ \t]+(?:${CITATION})([.:]?)([ \t]*)`,
      "gi",
    ),
    (
      whole: string,
      before: string,
      punctuation: string,
      after: string,
      offset: number,
      full: string,
    ) => {
      if (
        punctuation !== "" &&
        !ownsTrailingPunctuation(punctuation, full, offset)
      )
        return `${punctuation}${after}`;
      return repairGap(
        before,
        after,
        full[offset - 1],
        full[offset + whole.length],
      );
    },
  );
  // 2. A verb FOLLOWS the id, so the id is the sentence's subject: take the whole phrase and
  //    restore the passive the sentence was reaching for. "as ADR-0005 requires" → "as required".
  out = out.replace(
    new RegExp(
      String.raw`\bas[ \t]+${ADR_IDS}[ \t]+(?:requires|mandates|demands)\b`,
      "g",
    ),
    "as required",
  );
  out = out.replace(
    new RegExp(
      String.raw`\b${ADR_IDS}[ \t]+(?:requires|mandates|forbids|states|defines)\b`,
      "g",
    ),
    (m) =>
      m.includes("forbids") ? "the standard forbids" : "the standard requires",
  );
  // 3. Id leading a parenthetical that carries real prose: "(ADR-0042 design foundation)" →
  //    "(design foundation)". Also covers a short internal phase code riding with it ("ADR-0249 G3").
  out = out.replace(
    new RegExp(
      String.raw`\((${ADR_IDS})(?:[ \t]+[A-Z]\d{1,3}| §\S+)?[ \t]+(?=[^)\s])`,
      "g",
    ),
    "(",
  );
  // 4. Id fused into a noun phrase — the following word absorbs the slot.
  //    "the ADR-0013 harness" → "the harness"; "per ADR-0161 decision 1" → "per decision 1".
  out = out.replace(
    new RegExp(
      String.raw`\b${ADR_IDS}(?:[ \t]+[A-Z]\d{1,3}| §\S+)?[ \t]+(?=[a-z])`,
      "g",
    ),
    "",
  );
  // 5. Whatever is left is a standalone citation. Remove it and repair only its own immediate
  //    surroundings: a stranded separator before it, and the space it leaves behind.
  out = out.replace(
    new RegExp(
      String.raw`([ \t]*)(?:[-—,;·][ \t]*)?(?:${CITATION})(?:[ \t]+[A-Z]\d{1,3}| §\S+)?([.:]?)([ \t]*)`,
      "g",
    ),
    (
      whole: string,
      before: string,
      punctuation: string,
      after: string,
      offset: number,
      full: string,
    ) => {
      if (
        punctuation !== "" &&
        !ownsTrailingPunctuation(punctuation, full, offset)
      )
        return `${punctuation}${after}`;
      return repairGap(
        before,
        after,
        full[offset - 1],
        full[offset + whole.length],
      );
    },
  );
  return out;
}

/**
 * Strips every ADR id from `text`, parenthesised or not.
 *
 * Parentheticals are handled FIRST and as whole units: each `(…)` whose interior mentions an ADR
 * is stripped, and the parens themselves are dropped only when their interior stripped to nothing.
 * That unit-matching is the entire safety property — the empty-parens case is decided from the
 * interior this function just emptied, never by scanning the document for `()`. A document-wide
 * `/\(\s*\)/g` pass is what previously turned `z.object().strict()` into `z.object.strict`; a real
 * empty call is untouchable here because it never contains an ADR id to begin with.
 */
export function stripAdrIds(text: string): string {
  const parensHandled = text.replace(
    // The interior deliberately cannot cross a newline. `[^()]*` did, and re-emitting a stripped
    // multi-line interior on one line JOINED the two source lines — in a wrapped `//` comment that
    // silently welds a comment fragment onto the next line ("lock (ADR-0229\n// row 57)" exported as
    // "lock (// row 57), composing…"). A citation split across a line break is left to the inline
    // rules instead, which never move text between lines.
    /([ \t]*)\(([^()\n]*)\)([.:]?)([ \t]*)/g,
    (
      whole: string,
      before: string,
      interior: string,
      punctuation: string,
      after: string,
      offset: number,
      full: string,
    ) => {
      if (!HAS_ADR.test(interior)) return whole;
      const stripped = stripAdrIdsInline(interior).trim();
      if (stripped.length > 0)
        return `${before}(${stripped})${punctuation}${after}`;
      // Interior held nothing but the citation — drop the parens with it, repairing only this span.
      if (
        punctuation !== "" &&
        !ownsTrailingPunctuation(punctuation, full, offset)
      )
        return `${punctuation}${after}`;
      return repairGap(
        before,
        after,
        full[offset - 1],
        full[offset + whole.length],
      );
    },
  );
  return stripAdrIdsInline(parensHandled);
}

/** Applies `sanitizeAdrCitations` only inside `//` line comments and `/* … *\/` block comments —
 *  code outside a comment is never touched. The `(?<!:)` guard keeps a `https://`-style URL
 *  string from being misread as the start of a line comment. String/template literals are matched
 *  and passed through UNCHANGED before comments are considered — without this, a string literal
 *  containing a raw `/*`/`*\/`-lookalike sequence (e.g. a comment-injection test fixture) gets
 *  misread as spanning into the next real comment closer, and the blanket empty-parens cleanup in
 *  `sanitizeAdrCitations` then strips `()` out of real code caught in that false span (found via
 *  the mirror's own `bunx eslint .`: `packages/cli/src/demo.test.ts`'s hostile-string fixture
 *  turned `expect(stub).toBeDefined();` into `expect(stub).toBeDefined;` — a silently no-op
 *  assertion). ponytail: a regex scan, not a real parser — string-literal-aware is the floor this
 *  bug needs; nested `${}` template-literal expressions are not specially handled (none in this
 *  corpus today), and neither are JS regex literals containing `/*` (e.g. `/foo\/\*bar/`) — a
 *  literal like that could open the same false comment span this fix closes for strings. A corpus
 *  scan found zero such cases today; a transpile-based fail-loud guardrail is deliberately deferred,
 *  not built here. Exported for unit testing. */
export function sanitizeSourceComments(code: string): string {
  return code.replace(
    /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g,
    (token) => {
      if (!token.startsWith("/*") && !token.startsWith("//")) return token;
      return sanitizeAdrCitations(token).replace(/\n([ \t]*\*)\./g, ".\n$1");
    },
  );
}

function rewriteProseFiles(
  destDir: string,
  openSlugs: ReadonlySet<string>,
): void {
  for (const name of PACKAGE_PROSE_FILES) {
    const abs = join(destDir, name);
    if (!existsSync(abs)) continue;
    const before = readFileSync(abs, "utf8");
    const after = sanitizeAdrCitations(rewriteProseMentions(before, openSlugs));
    if (after !== before) writeFileSync(abs, after);
  }
}

function sanitizeComponentManifest(outDir: string): void {
  const manifestPath = join(
    outDir,
    "packages/ds-manifest/src/base-manifest.json",
  );
  if (!existsSync(manifestPath)) return;
  const before = readFileSync(manifestPath, "utf8");
  const after = sanitizeAdrCitations(before);
  if (after !== before) writeFileSync(manifestPath, after);
}

/** Task 1.1 (root cause 7533e88d886e6812): the eu-ai-act-sample template ships inside the public
 *  `@caisson-sh/cli` package and MUST resolve entirely from public npm — no commercial-registry
 *  configuration required. `REWRITE_SKIP_DIRS` intentionally still skips `templates/` for the
 *  general per-package walk above (a FUTURE template may carry buyer-repo data meant to stay
 *  `@caisson/`-scoped for the commercial registry); this is instead a targeted walk of this one
 *  sample's own tree, run once its package (`@caisson/cli`) has been copied.
 *
 *  Unlike the rest of the exported set, this tree carries no `@caisson/<slug>` PRODUCT/module-id
 *  literal that must survive unrenamed — every mention (import specifier, the package.json
 *  dependency, and doc/comment prose) is the npm scope, so a blanket rewrite is correct here. The
 *  `"name": "{{projectName}}"` template placeholder never matches the scope pattern, so it needs
 *  no special-casing. */
function rewriteCliTemplates(
  outDir: string,
  openSlugs: ReadonlySet<string>,
): void {
  const sampleDir = join(outDir, "packages/cli/templates/eu-ai-act-sample");
  if (!existsSync(sampleDir)) return;
  rewriteTreeBlanket(sampleDir, openSlugs);
}

/**
 * Applies `stripAdrIds` to EVERY text file in the export — source, markdown, JSON, CSS alike.
 *
 * Uniform application is load-bearing, not laziness. Several `__golden__` fixtures are byte-compared
 * against output produced by generators and templates that carry ADR ids of their own; stripping
 * one side and not the other would turn a green golden test red. Because the same transformation
 * runs over the generator, the template, and the fixture, the comparison still holds. The same
 * argument covers a thrown error message asserted by a test: both the `throw` and the `expect` are
 * rewritten identically. The mirror-sync verification gate is what proves that claim on every sync
 * rather than on this one reading of the tree.
 *
 * KNOWN CEILING — the one case that gate cannot see. A test whose FIXTURE is itself a citation
 * ("this input contains an ADR id, so the checker must flag it") is rewritten like any other text.
 * If the assertion depends on the citation, the test goes red and the gate catches it; if the
 * assertion is that nothing is flagged, the test goes VACUOUS and stays green for the wrong reason.
 * No such fixture is in the open set today — the two in `tooling/standards-gate` are commercial and
 * never exported — but a future Apache-2.0 package could add one. The fix if it happens is an
 * `EXCLUDE_TEST_FILES` entry, not a cleverer regex.
 */
function stripAdrIdsInTree(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") stripAdrIdsInTree(abs);
      continue;
    }
    let before: string;
    try {
      before = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (!HAS_ADR.test(before)) continue;
    const after = stripAdrIds(before);
    if (after !== before) writeFileSync(abs, after);
  }
}

function rewriteTreeBlanket(dir: string, openSlugs: ReadonlySet<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteTreeBlanket(abs, openSlugs);
      continue;
    }
    const before = readFileSync(abs, "utf8");
    const after = rewriteProseMentions(
      rewriteImportSpecifiers(before),
      openSlugs,
    );
    if (after !== before) writeFileSync(abs, after);
  }
}

/** Task 3.5 (finding b7198f6d6867ff39, validator half — the migrate/README.md source claim fix is
 *  a separate change): a mirrored README claiming a commercial license for a package this exporter
 *  ships as Apache-2.0 is a buyer-trust defect. Every package actually shipped here carries
 *  `license: "Apache-2.0"` post-rewrite (see `rewritePackageJson` — the open set + restamped
 *  tooling), so any commercial-license claim string in the copied README is definitionally wrong.
 *  Fails loudly, mirroring the self-containment gate's FATAL pattern in `main()`. */
function assertReadmeLicenseAgreement(destDir: string, npmName: string): void {
  const readmePath = join(destDir, "README.md");
  if (!existsSync(readmePath)) return;
  const text = readFileSync(readmePath, "utf8");
  if (/licenseref-caisson-commercial|\bcommercial license\b/i.test(text)) {
    console.error(
      `FATAL: ${npmName}'s mirrored README.md claims a commercial license, but this exporter ships every selected package as Apache-2.0.`,
    );
    process.exit(1);
  }
}

/** Structural rewrite of a package-root package.json: rename its scope + internal dep keys, apply
 *  script overrides, restamp tooling licenses. */
function rewritePackageJson(
  json: PkgJson,
  restampApache: boolean,
  catalogConfig: CatalogConfig,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...json };
  out.name = renameScope(json.name);
  if (restampApache) out.license = APACHE;
  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ] as const) {
    const src = json[key];
    if (!src) continue;
    const dropped =
      key === "devDependencies"
        ? DROP_COMMERCIAL_DEV_DEPS.get(json.name)
        : undefined;
    const renamed: Record<string, string> = {};
    for (const [dep, ver] of Object.entries(src)) {
      if (dropped?.has(dep)) continue; // commercial dev-only fixture; its tests are excluded
      renamed[renameScope(dep)] = resolveCatalogSpec(dep, ver, catalogConfig);
    }
    out[key] = renamed;
  }
  const scripts = { ...(json.scripts ?? {}) };
  if (DROP_TEST_SCRIPT.has(json.name)) delete scripts.test;
  const testOverride = TEST_SCRIPT_OVERRIDES[json.name];
  if (testOverride && scripts.test !== undefined) scripts.test = testOverride;
  const buildOverride = BUILD_SCRIPT_OVERRIDES[json.name];
  if (buildOverride && scripts.build !== undefined)
    scripts.build = buildOverride;
  out.scripts = scripts;
  return out;
}

function copyPkg(srcDir: string, destDir: string): void {
  // "manifest.ts" (task 3.2, finding 6c975cfc31c03a6f): every package's registry manifest imports
  // `../../registry/schema/module-manifest` — a path that dangles once the package is copied
  // standalone into the mirror. Its consumer (standards-gate) never ships in the mirror either, so
  // the file is dead weight with a broken import; simplest correct fix is to never copy it, same
  // mechanic as node_modules/dist/.turbo. Confirmed package-root-level only, no nested collisions.
  const skip = new Set([
    "node_modules",
    "dist",
    "migrations-bundle",
    ".turbo",
    "coverage",
    "manifest.ts",
  ]);
  cpSync(srcDir, destDir, {
    recursive: true,
    filter: (src) => !skip.has(src.split("/").pop() ?? ""),
  });
}

function main(): void {
  const repoRoot = resolve(import.meta.dir, "..");
  const { out, generatedAt, allowMissingExcludes } = parseArgs(
    Bun.argv.slice(2),
  );
  const outDir = resolveMirrorOutDir(repoRoot, out);

  const sourceRootPkg = readJson(join(repoRoot, "package.json")) as PkgJson & {
    workspaces?: {
      catalog?: Record<string, string>;
      catalogs?: Record<string, Record<string, string>>;
    };
  };
  const catalogConfig: CatalogConfig = {
    catalog: sourceRootPkg.workspaces?.catalog ?? {},
    catalogs: sourceRootPkg.workspaces?.catalogs,
  };

  const all = [
    ...scanGroup(repoRoot, "packages"),
    ...scanGroup(repoRoot, "tooling"),
  ];
  const licenseByName = new Map(
    all.map((p) => [p.json.name, p.json.license ?? ""]),
  );

  const apachePkgs = all.filter(
    (p) => p.group === "packages" && p.json.license === APACHE,
  );
  const supportPkgs = all.filter((p) => BUILD_SUPPORT.has(p.json.name));
  const missingSupport = [...BUILD_SUPPORT].filter(
    (n) => !supportPkgs.some((p) => p.json.name === n),
  );
  if (missingSupport.length) {
    console.error(
      `FATAL: build-support tooling not found in tooling/: ${missingSupport.join(", ")}`,
    );
    process.exit(1);
  }
  const selected = [...apachePkgs, ...supportPkgs];
  const exported = new Set(selected.map((p) => p.json.name)); // ORIGINAL @caisson names
  // Bare slugs of the open set — the prose rename's allowlist (commercial mentions stay @caisson/*).
  const openSlugs = new Set(
    [...exported].map((n) => n.slice(OLD_SCOPE.length)),
  );

  // --- self-containment gate: no selected package may depend on a commercial package ---
  const violations: string[] = [];
  for (const p of selected) {
    for (const key of ["dependencies", "peerDependencies"] as const) {
      for (const dep of internalDeps(p.json, key)) {
        if (!exported.has(dep)) {
          const why =
            licenseByName.get(dep) === COMMERCIAL
              ? "COMMERCIAL"
              : "not-exported";
          violations.push(`${p.group}/${p.slug} → ${dep} (${key}, ${why})`);
        }
      }
    }
    for (const dep of internalDeps(p.json, "devDependencies")) {
      if (DROP_COMMERCIAL_DEV_DEPS.get(p.json.name)?.has(dep)) continue; // stripped in the mirror
      if (licenseByName.get(dep) === COMMERCIAL)
        violations.push(
          `${p.group}/${p.slug} → ${dep} (devDependencies, COMMERCIAL)`,
        );
    }
  }
  if (violations.length) {
    console.error(
      "FATAL: open set is NOT self-contained — selected package(s) depend on a commercial package:",
    );
    for (const v of violations) console.error(`  ✗ ${v}`);
    process.exit(1);
  }

  // --- write the mirror ---
  assertMirrorOutDirHasNoSymlinkAncestors(
    resolve(repoRoot, "mirror-out"),
    outDir,
  );
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const apacheLicenseText = readFileSync(
    join(repoRoot, "packages/kernel/LICENSE"),
    "utf8",
  );
  const excludedApplied: Array<{ file: string; reason: string }> = [];
  const manifestPkgs: Array<{
    npmName: string;
    productName: string;
    version: string;
    license: string;
    path: string;
    buildSupport: boolean;
  }> = [];

  for (const p of selected) {
    const destDir = join(outDir, p.group, p.slug);
    copyPkg(p.dir, destDir);

    // drop excluded test files that belong to this package
    for (const [rel, reason] of EXCLUDE_TEST_FILES) {
      if (rel.startsWith(`${p.group}/${p.slug}/`)) {
        const dest = join(outDir, rel);
        if (existsSync(dest)) {
          rmSync(dest);
          excludedApplied.push({ file: rel, reason });
        }
      }
    }

    // scope-rename: import specifiers in the package's own source, tsconfig extends, root package.json
    rewriteImportsInTree(destDir);
    rewriteTsconfigRefs(destDir);
    rewriteProseFiles(destDir, openSlugs);
    if (p.json.name === "@caisson/cli") rewriteCliTemplates(outDir, openSlugs);
    const restamp = BUILD_SUPPORT.has(p.json.name);
    writeFileSync(
      join(destDir, "package.json"),
      JSON.stringify(
        rewritePackageJson(p.json, restamp, catalogConfig),
        null,
        2,
      ) + "\n",
    );
    if (restamp && !existsSync(join(destDir, "LICENSE")))
      writeFileSync(join(destDir, "LICENSE"), apacheLicenseText);
    assertReadmeLicenseAgreement(destDir, renameScope(p.json.name));

    manifestPkgs.push({
      npmName: renameScope(p.json.name),
      productName: p.json.name,
      version: p.json.version,
      license: APACHE,
      path: `${p.group}/${p.slug}`,
      buildSupport: restamp,
    });
  }
  manifestPkgs.sort((a, b) => a.npmName.localeCompare(b.npmName));
  // UI source comments lose private ADR citations above; keep their generated manifest in lockstep.
  sanitizeComponentManifest(outDir);

  const missedExcludes = [...EXCLUDE_TEST_FILES.keys()].filter(
    (rel) => !excludedApplied.some((e) => e.file === rel),
  );
  if (missedExcludes.length) {
    // Rot-guard for HEAD syncs (a renamed test would silently re-enter the mirror). Historical
    // backfill runs (ADR-0318 F2) legitimately predate some excluded tests — the explicit
    // `--allow-missing-excludes` flag downgrades to a warning there; the per-milestone gate
    // battery still applies. Flag, not env: it cannot leak in from a sticky operator shell.
    if (allowMissingExcludes) {
      console.warn(
        `WARN: excluded test file(s) not found (historical tree?): ${missedExcludes.join(", ")}`,
      );
    } else {
      console.error(
        `FATAL: excluded test file(s) not found (source moved?): ${missedExcludes.join(", ")}`,
      );
      process.exit(1);
    }
  }

  // root LICENSE (Apache-2.0) — standard for a public repo; per-package LICENSEs remain too.
  writeFileSync(join(outDir, "LICENSE"), apacheLicenseText);

  // root package.json — private workspace manifest (not published).
  const rootPkg = {
    name: "caisson-sh",
    private: true,
    type: "module",
    license: APACHE,
    description:
      "Caisson — open (Apache-2.0) base packages, published to npm as @caisson-sh/*. Public mirror of the Caisson monorepo.",
    workspaces: MIRROR_WORKSPACES,
    scripts: {
      build: "turbo run build --no-daemon",
      test: "turbo run test --no-daemon",
    },
    devDependencies: {
      "@types/bun": "^1.1.14",
      turbo: "~2.5.6",
      typescript: "^5.6.3",
      // Root eslint.config.js (shipped below) imports @caisson-sh/eslint-config — a `workspace:*`
      // reference resolves as a per-consumer symlink, not a root hoist, so root needs its own
      // entry for `bunx eslint .` to resolve it. eslint itself is that config's peerDependency;
      // pin it here too so the mirror's CI lint leg doesn't rely on bunx's on-the-fly install.
      "@caisson-sh/eslint-config": "workspace:*",
      eslint: "^10.0.0",
      prettier: "^3.3.3",
    },
    packageManager: "bun@1.3.14",
  };
  writeFileSync(
    join(outDir, "package.json"),
    JSON.stringify(rootPkg, null, 2) + "\n",
  );

  // minimal turbo pipeline — build (tsc, dep-ordered → cross-package .d.ts) + test.
  writeFileSync(
    join(outDir, "turbo.json"),
    JSON.stringify(
      {
        $schema: "https://turbo.build/schema.json",
        tasks: {
          build: { dependsOn: ["^build"], outputs: ["dist/**"] },
          test: {},
        },
      },
      null,
      2,
    ) + "\n",
  );

  // root tsconfig — extends the shared (renamed) base.
  writeFileSync(
    join(outDir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: `${NEW_SCOPE}tsconfig/base.json`,
        compilerOptions: { noEmit: true },
        files: [],
      },
      null,
      2,
    ) + "\n",
  );

  writeFileSync(
    join(outDir, ".gitignore"),
    ["node_modules/", "dist/", ".turbo/", "bun.lock", "*.tsbuildinfo", ""].join(
      "\n",
    ),
  );

  // Root bunfig.toml — same dist-ignore as the source repo (CAISSON-12): a bare `bun test` from
  // the mirror root must not discover stale compiled dist/**.test.js alongside src/. The
  // tooling/testing dist-test-shadow test asserts this file exists here too (W1 re-validation).
  writeFileSync(
    join(outDir, "bunfig.toml"),
    [
      "[test]",
      "# A bare `bun test` recursively discovers every *.test.ts/js under cwd, including stale",
      "# compiled dist/ output left by a prior `bun run build` — keep discovery on src/.",
      'pathIgnorePatterns = ["**/dist/**"]',
      "",
    ].join("\n"),
  );

  // bun.lock-free install note.
  writeFileSync(
    join(outDir, "INSTALL.md"),
    [
      "# Install",
      "",
      "No lockfile is committed to this mirror — dependencies resolve fresh from npm.",
      "",
      "```bash",
      "bun install",
      "bun run test",
      "```",
      "",
      "Requires [Bun](https://bun.sh) `>= 1.3`. This is a generated, read-only mirror; see CONTRIBUTING.md.",
      "",
    ].join("\n"),
  );

  // GTM / community-health assets (README / CONTRIBUTING / TRADEMARK / SECURITY / SUPPORT /
  // CODE_OF_CONDUCT / mirror CI / mirror publish / issue template), authored under
  // scripts/mirror-assets/ per the MIRROR_ASSET_FILES table above. TRADEMARK.md must ship
  // before the mirror goes public (ADR-0319 — Apache-2.0 §6 grants no trademark rights; the
  // policy closes the gap).
  const assets = join(repoRoot, "scripts/mirror-assets");
  for (const { src, dest } of MIRROR_ASSET_FILES) {
    const destPath = join(outDir, dest);
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(join(assets, src), destPath);
  }

  // registry.json — the shadcn GitHub-source registry over the exported @caisson/ui components
  // (Kickoff T task 13 / ADR-0343): `bunx shadcn@latest add caisson-sh/caisson-oss/<item>`.
  // Generated per export from the SOURCE tree (the mirror copies packages/ui verbatim, so the
  // source-derived file paths hold in the mirror layout); never committed, so it can't drift.
  writeFileSync(
    join(outDir, "registry.json"),
    JSON.stringify(buildShadcnRegistry(repoRoot), null, 2) + "\n",
  );

  // MIRROR-MANIFEST.json — provenance for the generated repo.
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
  })
    .toString()
    .trim();
  writeFileSync(
    join(outDir, "MIRROR-MANIFEST.json"),
    JSON.stringify(
      {
        sourceRepo: SOURCE_REPO,
        sourceCommit,
        generatedAt,
        license: APACHE,
        npmScope: NEW_SCOPE.replace(/\/$/, ""),
        productScope: OLD_SCOPE.replace(/\/$/, ""),
        note: "Packages publish to npm as @caisson-sh/*. The @caisson/<slug> registry module-ids (registry-schema data, golden fixtures) are PRODUCT ids served by the commercial registry at caisson.sh — left intact, not npm names.",
        packages: manifestPkgs,
        excludedTests: excludedApplied,
      },
      null,
      2,
    ) + "\n",
  );

  // Strip internal decision-log ids from the whole tree. Runs BEFORE prettier so that the residue
  // a removal leaves in a wrapped comment — a short line, an orphaned continuation — gets reflowed
  // in the same pass that formats everything else, instead of shipping as ragged prose.
  stripAdrIdsInTree(outDir);

  // Reformat the exported tree with the SOURCE repo's own installed prettier (`.prettierignore`
  // above exempts golden fixtures + the drift-guarded tokens.css, same as the source repo's own
  // ignore file). The npm scope rename (`@caisson/` → `@caisson-sh/`, 3 chars longer) sometimes
  // pushes an import specifier that fit the source file's print width over it — reformatting once,
  // here, keeps the mirror `prettier --check` clean regardless of how any future rename or export
  // transform happens to interact with a source file's pre-existing wrap width, rather than chasing
  // individual source files by hand every time the scope shifts a line length.
  execFileSync(
    resolve(repoRoot, "node_modules/.bin/prettier"),
    ["--write", "--log-level", "warn", "."],
    { cwd: outDir, stdio: "inherit" },
  );

  // --- entitlement-token gate: nothing shaped like a license token ships unless dev-signed ---
  const tokenHits: string[] = [];
  scanForEntitlementTokens(outDir, tokenHits);
  if (tokenHits.length) {
    console.error(
      "FATAL: entitlement-token-shaped string(s) in the mirror output that do NOT verify against the dev test keypair (a real token is the entitlement itself — never ship one):",
    );
    for (const h of tokenHits) console.error(`  ${h}`);
    process.exit(1);
  }

  // --- internal-reference gate: no unresolvable internal breadcrumb ships to the public repo ---
  const leaks: string[] = [];
  scanForInternalReferences(outDir, leaks);
  if (leaks.length) {
    console.error(
      "FATAL: internal reference(s) in the mirror output — these resolve to nothing for a public reader (a private-repo path, an internal decision-log id, or an internal doc tree):",
    );
    for (const h of leaks.slice(0, 40)) console.error(`  ${h}`);
    if (leaks.length > 40)
      console.error(
        `  … and ${leaks.length - 40} more (${leaks.length} total)`,
      );
    process.exit(1);
  }

  console.log(`Exported ${manifestPkgs.length} package(s) to ${outDir}`);
  console.log(`  source commit ${sourceCommit}`);
  console.log(
    `  npm scope ${NEW_SCOPE}* (product/module-ids remain ${OLD_SCOPE}*)`,
  );
  for (const p of manifestPkgs)
    console.log(
      `  ${p.buildSupport ? "[tool]" : "[pkg] "} ${p.npmName}@${p.version}`,
    );
  for (const e of excludedApplied) console.log(`  excluded test: ${e.file}`);
}

if (import.meta.main) main();
