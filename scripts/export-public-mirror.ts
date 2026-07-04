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
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";
import { join, resolve } from "node:path";

const APACHE = "Apache-2.0";
const COMMERCIAL = "LicenseRef-Caisson-Commercial";
const SOURCE_REPO = "caisson-sh/caisson";
const OLD_SCOPE = "@caisson/";
const NEW_SCOPE = "@caisson-sh/";

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
const EXCLUDE_TEST_FILES: ReadonlyMap<string, string> = new Map([
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
} {
  let out = "./mirror-out";
  let generatedAt = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out = argv[++i] ?? out;
    else if (a === "--generated-at") generatedAt = argv[++i] ?? "";
  }
  if (!generatedAt) {
    console.error(
      "FATAL: --generated-at <iso-date> is required (the caller passes it; Date.now is fine in repo scripts).",
    );
    process.exit(1);
  }
  return { out, generatedAt };
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

/** Rewrite EVERY bare `@caisson/<slug>` mention → `@caisson-sh/<slug>`, regardless of surrounding
 *  syntax — broader than `rewriteImportSpecifiers`'s import/require-keyword guard. Used for doc
 *  prose (README/CHANGELOG/AGENTS.md bodies, task 3.1) where a scope mention is never in import
 *  position (a CHANGELOG "Updated dependencies" line, a README title/code-fence comment). */
function rewriteProseMentions(text: string): string {
  return text.replace(
    /@caisson\/([\w.-]+)/g,
    (_m, rest) => `${NEW_SCOPE}${rest}`,
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
    const after = rewriteImportSpecifiers(before);
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

function rewriteProseFiles(destDir: string): void {
  for (const name of PACKAGE_PROSE_FILES) {
    const abs = join(destDir, name);
    if (!existsSync(abs)) continue;
    const before = readFileSync(abs, "utf8");
    const after = rewriteProseMentions(before);
    if (after !== before) writeFileSync(abs, after);
  }
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
function rewriteCliTemplates(outDir: string): void {
  const sampleDir = join(outDir, "packages/cli/templates/eu-ai-act-sample");
  if (!existsSync(sampleDir)) return;
  rewriteTreeBlanket(sampleDir);
}

function rewriteTreeBlanket(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteTreeBlanket(abs);
      continue;
    }
    const before = readFileSync(abs, "utf8");
    const after = rewriteProseMentions(rewriteImportSpecifiers(before));
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
    const renamed: Record<string, string> = {};
    for (const [dep, ver] of Object.entries(src))
      renamed[renameScope(dep)] = ver;
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
  const { out, generatedAt } = parseArgs(Bun.argv.slice(2));
  const outDir = resolve(repoRoot, out);

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
    rewriteProseFiles(destDir);
    if (p.json.name === "@caisson/cli") rewriteCliTemplates(outDir);
    const restamp = BUILD_SUPPORT.has(p.json.name);
    writeFileSync(
      join(destDir, "package.json"),
      JSON.stringify(rewritePackageJson(p.json, restamp), null, 2) + "\n",
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

  const missedExcludes = [...EXCLUDE_TEST_FILES.keys()].filter(
    (rel) => !excludedApplied.some((e) => e.file === rel),
  );
  if (missedExcludes.length) {
    console.error(
      `FATAL: excluded test file(s) not found (source moved?): ${missedExcludes.join(", ")}`,
    );
    process.exit(1);
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
    workspaces: ["packages/*", "tooling/*"],
    scripts: {
      build: "turbo run build --no-daemon",
      test: "turbo run test --no-daemon",
    },
    devDependencies: {
      "@types/bun": "^1.1.14",
      turbo: "~2.5.6",
      typescript: "^5.6.3",
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

  // GTM assets (README / CONTRIBUTING / mirror CI / mirror publish), authored under
  // scripts/mirror-assets/.
  const assets = join(repoRoot, "scripts/mirror-assets");
  cpSync(join(assets, "README.md"), join(outDir, "README.md"));
  cpSync(join(assets, "CONTRIBUTING.md"), join(outDir, "CONTRIBUTING.md"));
  mkdirSync(join(outDir, ".github/workflows"), { recursive: true });
  cpSync(join(assets, "ci.yml"), join(outDir, ".github/workflows/ci.yml"));
  cpSync(
    join(assets, "publish.yml"),
    join(outDir, ".github/workflows/publish.yml"),
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

main();
