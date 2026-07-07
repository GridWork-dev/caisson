// Generator DEMO MODE (ADR-0274 §1 / Track E1). `create-caisson --demo` composes the SAME base
// scaffold as a licensed build across the FULL registry catalog, but never delivers commercial
// source: every paid-tier module becomes a local stub file derived ENTIRELY from registry
// METADATA (id, description, declared dependencies) — this module never reads a commercial
// package's real implementation, because it never has one to read (the generator's only input is
// the committed `registry/index.json`, same as the licensed path). No license, no license-service
// call, no network beyond the existing registry-index read `generate()` already performs.
import type { RegistryIndex } from "@caisson/registry-schema";
import { generate } from "./generate.ts";
import type { GeneratedFileSet } from "./generate.ts";

/** One catalog module as demo mode resolved it: a real npm dependency (oss) or a local stub
 *  (paid) — plus the metadata the stub is synthesized from. */
export interface DemoModuleSummary {
  readonly id: string;
  readonly version: string;
  readonly tier: "oss" | "paid";
  readonly description: string;
  readonly dependencies: readonly string[];
}

const STUB_DIR = "src/demo-stubs";

/** The not-for-production banner every demo-mode doc file carries (README/AGENTS/DEMO.md). */
export const DEMO_WATERMARK =
  "> **CAISSON DEMO STUB — NOT FOR PRODUCTION.** Commercial modules below are stand-in stubs " +
  "generated from public registry metadata only; get a license at https://caisson.sh to install " +
  "the real implementation.";

function stubPath(moduleId: string): string {
  return `${STUB_DIR}/${moduleId.replace(/^@caisson\//, "")}.ts`;
}

/**
 * Make `text` safe to interpolate into a `/** *\/` block comment. `JSON.stringify` collapses
 * newlines/quotes/control chars into a single escaped line, but it does NOT escape a literal
 * `*\/` — a hostile module description containing `*\/ throw new Error("pwn") /*` would otherwise
 * close the comment early and turn the remainder into executable code the moment the stub is
 * imported. Break that two-char sequence explicitly (metadata → source injection, security P1/P2).
 */
function commentSafe(text: string): string {
  return JSON.stringify(text).replace(/\*\//g, "* /");
}

/**
 * A demo stub for one commercial module: the default export is a recursive throwing Proxy — every
 * property read returns ANOTHER stub of the same shape (never `undefined`), and calling one at any
 * depth throws, carrying the `CAISSON DEMO STUB` marker. This is the only way to stand in for "the
 * module's real public interface surface" without knowing its actual shape — the generator never
 * reads commercial source, so it cannot know real export names; a catch-all runtime proxy is the
 * honest stub for an unknown surface, never a guessed one. `has`/`ownKeys`/`getOwnPropertyDescriptor`
 * traps keep `in`/`Object.keys`/property introspection from silently lying about the stub's shape;
 * `then`/`toJSON` are excluded from the recursive-proxy behavior so `await`/`JSON.stringify` never
 * mistake the stub for a thenable or misbehave on serialization.
 */
function stubFile(entry: DemoModuleSummary): { path: string; content: string } {
  const deps =
    entry.dependencies.length > 0 ? entry.dependencies.join(", ") : "(none)";
  const content = `/**
 * CAISSON DEMO STUB — NOT FOR PRODUCTION
 *
 * Stand-in for the commercial module below. 'create-caisson --demo' never reads or downloads
 * Caisson's commercial source; every export here is synthesized from public registry metadata
 * and throws at call time. Get a license at https://caisson.sh to install the real module.
 *
 * Module:       ${entry.id}
 * Description:  ${commentSafe(entry.description)}
 * Dependencies: ${deps}
 */

function demoStub(moduleId: string, path: readonly string[] = []): unknown {
  const label = [moduleId, ...path].join(".");
  const throwStub = (): never => {
    throw new Error(
      "CAISSON DEMO STUB: " +
        label +
        "() is not implemented — this is a demo scaffold, not the licensed module. Get a " +
        "license at https://caisson.sh",
    );
  };
  return new Proxy(throwStub, {
    apply(): never {
      return throwStub();
    },
    get(_target, prop): unknown {
      if (typeof prop !== "string" || prop === "then" || prop === "toJSON") {
        return undefined;
      }
      return demoStub(moduleId, [...path, prop]);
    },
    has(): boolean {
      return true;
    },
    ownKeys(): (string | symbol)[] {
      return [];
    },
    getOwnPropertyDescriptor(): PropertyDescriptor {
      return { value: undefined, writable: true, enumerable: true, configurable: true };
    },
  });
}

/** Every import from this module resolves here — every call throws the CAISSON DEMO STUB marker. */
export default demoStub(${JSON.stringify(entry.id)});
`;
  return { path: stubPath(entry.id), content };
}

// The demo `.npmrc`: the scope mapping ONLY, no `_authToken` line. `registry.caisson.sh`'s Worker
// is fail-safe-to-base (serves the free/oss module set to an unauthenticated request) — the SAME
// contract every unlicensed base-only build already relies on, zero server-side change. This is a
// SECURITY FIX (F1, P1): deleting `.npmrc` outright left the demo package.json's exact-pinned
// `@caisson/*` oss deps to resolve against PUBLIC npm, a scope Caisson does not hold — a
// dependency-confusion hole (anyone who claims `@caisson` on npm could publish malicious packages
// at exactly the ids+versions every demo project pins) on top of a guaranteed 404.
const DEMO_NPMRC = "@caisson:registry=https://registry.caisson.sh\n";

// The base README's licensed-install instruction (`templates/base/README.md`) is WRONG in demo
// mode — no token is used or needed. Swapped for the demo-accurate note wherever it appears (a
// no-op replace if the base template text ever drifts — the banner still lands regardless).
const REGISTRY_INSTALL_NOTE =
  "Install from `registry.caisson.sh` with your license token in `CAISSON_LICENSE_TOKEN`\n" +
  "(see `.npmrc`).";
const DEMO_INSTALL_NOTE =
  "Free (Apache-2.0) modules above install from the Caisson registry (`registry.caisson.sh`) — " +
  "no license key needed, see `.npmrc`. Commercial modules are local stubs under " +
  "`src/demo-stubs/` (see DEMO.md), not installed dependencies. Get a license at " +
  "https://caisson.sh to install the real thing.";

// The rendered "## Installed modules" list (`{{moduleList}}`, engine-templates.ts) lists EVERY
// selected module identically, with no tier marker — in demo mode that reads as "all 44 modules
// are installed", which is false for the ~2/3 that are stubs. A short note under the heading
// corrects it without needing to reconstruct/match the exact rendered list text (code review P2-1).
const INSTALLED_MODULES_HEADING = "## Installed modules\n\n";
const STUB_NOTE_IN_LIST =
  "> Commercial (paid-tier) entries below are DEMO STUBS, not installed dependencies — see " +
  "`DEMO.md` for which are real installs vs. stubs.\n\n";

// AGENTS.md's base "Working in this repo" bullet flatly claims every `@caisson/*` module is a
// versioned dependency you upgrade via package.json, never edited in node_modules — FALSE for a
// demo stub, which is editable source under `src/demo-stubs/`, absent from package.json entirely.
// An agent trusting the base claim could "helpfully" hand-edit node_modules instead of the real
// stub file, or assume upgrading package.json touches a stub at all (code review P2-1).
const AGENTS_DEPENDENCY_CLAIM =
  "- The installed `@caisson/*` modules are versioned dependencies, not vendored source — upgrade\n" +
  "  them through `package.json`, never by editing inside `node_modules`.";
const AGENTS_DEMO_DEPENDENCY_NOTE =
  "- Free (oss) `@caisson/*` modules are versioned dependencies — upgrade via `package.json`.\n" +
  "  Every commercial module is a LOCAL STUB under `src/demo-stubs/` (editable source, not a\n" +
  "  dependency, not the licensed module) — see `DEMO.md`.";

/** Prepend the demo watermark to an existing doc file's content (README.md/AGENTS.md), correct the
 *  "all modules installed" module-list claim, swap the licensed-install instruction, and neutralize
 *  AGENTS.md's false versioned-dependencies claim — every swap is a no-op where its target text
 *  isn't present, so this is safe to apply to both files uniformly. */
function withDemoBanner(markdown: string): string {
  let rewritten = markdown;
  if (rewritten.includes(INSTALLED_MODULES_HEADING)) {
    rewritten = rewritten.replace(
      INSTALLED_MODULES_HEADING,
      INSTALLED_MODULES_HEADING + STUB_NOTE_IN_LIST,
    );
  }
  if (rewritten.includes(REGISTRY_INSTALL_NOTE)) {
    rewritten = rewritten.replace(REGISTRY_INSTALL_NOTE, DEMO_INSTALL_NOTE);
  }
  if (rewritten.includes(AGENTS_DEPENDENCY_CLAIM)) {
    rewritten = rewritten.replace(
      AGENTS_DEPENDENCY_CLAIM,
      AGENTS_DEMO_DEPENDENCY_NOTE,
    );
  }
  return `${DEMO_WATERMARK}\n\n${rewritten}`;
}

function demoManifest(
  projectName: string,
  catalog: readonly DemoModuleSummary[],
): string {
  const lines = [
    `# ${projectName} — demo mode`,
    "",
    DEMO_WATERMARK,
    "",
    "Generated by `create-caisson --demo` against the full Caisson catalog. Free (Apache-2.0) " +
      "modules below install for real from the Caisson registry (no license key needed); every " +
      "commercial module is a local stub under `src/demo-stubs/` — not the licensed source, " +
      "never for production.",
    "",
    "## Catalog",
    "",
    ...catalog.map((m) =>
      m.tier === "oss"
        ? `- \`${m.id}\` @ ${m.version} — installed (Apache-2.0, free)`
        : `- \`${m.id}\` @ ${m.version} — **stub** (\`${stubPath(m.id)}\`): ${m.description}`,
    ),
    "",
    "## Going to production",
    "",
    "Get a license at https://caisson.sh, then regenerate with `create-caisson --module " +
      "<id@version> ...` for the modules you actually need — these stubs are evaluation-only and " +
      "are never licensable for production use.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

/** Resolve every module the registry index knows about, at its `latest` version, with the
 *  metadata a stub needs — sorted for deterministic output. */
function resolveCatalog(index: RegistryIndex): DemoModuleSummary[] {
  return [...index.modules]
    .map((m): DemoModuleSummary => {
      const v = m.versions.find((ver) => ver.version === m.latest);
      // Unreachable for a well-formed index (every `RegistryModuleEntry.latest` names one of its
      // own `versions`, enforced at registry-build time) — fail closed rather than synthesize.
      if (!v) {
        throw new Error(
          `registry inconsistency: ${m.id} latest ${m.latest} has no matching version entry`,
        );
      }
      return {
        id: m.id,
        version: m.latest,
        tier: v.manifest.tier,
        description: v.manifest.description,
        dependencies: v.manifest.dependencies,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Every dependency-map field npm/bun reads when installing — a paid id must be stripped from ALL
 *  four, not just `dependencies` (code review P2-4): a template overlay could plant one in
 *  `peerDependencies`/`optionalDependencies` and a stray reference would still try (and fail) to
 *  install a stub as a real package. */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

/** Strip every paid-tier module from every dependency map (no install attempt for a stub — it has
 *  no npm package) and mark the package as demo-generated. Exported for a direct unit test
 *  covering all four fields, independent of what the current base template happens to populate. */
export function stripPaidDependencies(
  pkgContent: string,
  paidIds: ReadonlySet<string>,
): string {
  const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...pkg, caissonDemo: true };
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (deps === undefined) continue;
    next[field] = Object.fromEntries(
      Object.entries(deps).filter(([id]) => !paidIds.has(id)),
    );
  }
  return `${JSON.stringify(next, null, 2)}\n`;
}

/**
 * Materialize the demo project: the same `base` templated scaffold `generate()` produces for a
 * licensed build, composed over the FULL registry catalog, then post-processed so no commercial
 * source is ever required or delivered:
 *  - `.npmrc` is replaced with a TOKENLESS scope mapping — oss installs resolve against
 *    `registry.caisson.sh` (fail-safe-to-base), never public npm (F1: the `@caisson` scope is not
 *    Caisson's on public npm — resolving there is both a guaranteed 404 and a dependency-confusion
 *    hole).
 *  - every paid-tier module is removed from EVERY `package.json` dependency map and replaced by a
 *    local stub file under `src/demo-stubs/`.
 *  - oss modules are untouched — they install for real, exactly like a licensed build.
 *  - README.md/AGENTS.md gain the not-for-production banner, a corrected module list, and (AGENTS)
 *    a corrected dependency claim; a root DEMO.md lists the full catalog.
 * Pure construction — no disk write, no network (mirrors `generate()`).
 */
export function generateDemo(
  index: RegistryIndex,
  raw: { projectName: string },
): {
  readonly projectName: string;
  readonly files: GeneratedFileSet;
  readonly modules: readonly DemoModuleSummary[];
} {
  const catalog = resolveCatalog(index);
  const { selection, files } = generate(index, {
    projectName: raw.projectName,
    modules: catalog.map(({ id, version }) => ({ id, version })),
  });

  const paidIds = new Set(
    catalog.filter((m) => m.tier === "paid").map((m) => m.id),
  );
  const byPath = new Map(files.map((f) => [f.path, f.content] as const));
  byPath.set(".npmrc", DEMO_NPMRC);

  const pkg = byPath.get("package.json");
  if (pkg !== undefined) {
    byPath.set("package.json", stripPaidDependencies(pkg, paidIds));
  }

  const readme = byPath.get("README.md");
  if (readme !== undefined) byPath.set("README.md", withDemoBanner(readme));

  const agents = byPath.get("AGENTS.md");
  if (agents !== undefined) byPath.set("AGENTS.md", withDemoBanner(agents));

  byPath.set("DEMO.md", demoManifest(selection.projectName, catalog));

  for (const m of catalog) {
    if (m.tier !== "paid") continue;
    const stub = stubFile(m);
    byPath.set(stub.path, stub.content);
  }

  const outFiles: GeneratedFileSet = [...byPath.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));

  return {
    projectName: selection.projectName,
    files: outFiles,
    modules: catalog,
  };
}
