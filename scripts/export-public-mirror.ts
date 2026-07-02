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
import { join, resolve } from "node:path";

const APACHE = "Apache-2.0";
const COMMERCIAL = "LicenseRef-Caisson-Commercial";
const SOURCE_REPO = "GridWork-dev/caisson";
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
    "materializes + EXECUTES the free eu-ai-act sample, whose emitted source imports the PRODUCT namespace @caisson/kernel (buyers install sample deps from the commercial registry at caisson.sh); that specifier does not resolve in the @caisson-sh/ npm mirror. The sample generator (sample-templates.ts) still ships.",
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
 *  Package-root only (never recurses into `templates/`, whose tsconfigs are buyer-repo data). */
function rewriteTsconfigRefs(pkgDir: string): void {
  for (const entry of readdirSync(pkgDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^tsconfig.*\.json$/.test(entry.name)) continue;
    const abs = join(pkgDir, entry.name);
    const before = readFileSync(abs, "utf8");
    const after = before.replace(
      /"@caisson\/(tsconfig|eslint-config|testing)\//g,
      `"${NEW_SCOPE}$1/`,
    );
    if (after !== before) writeFileSync(abs, after);
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
  const skip = new Set([
    "node_modules",
    "dist",
    "migrations-bundle",
    ".turbo",
    "coverage",
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
    const restamp = BUILD_SUPPORT.has(p.json.name);
    writeFileSync(
      join(destDir, "package.json"),
      JSON.stringify(rewritePackageJson(p.json, restamp), null, 2) + "\n",
    );
    if (restamp && !existsSync(join(destDir, "LICENSE")))
      writeFileSync(join(destDir, "LICENSE"), apacheLicenseText);

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
