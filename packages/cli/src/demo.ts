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
 * A demo stub for one commercial module: every property access on the default export returns a
 * function that throws, carrying the `CAISSON DEMO STUB` marker. This is the only way to stand in
 * for "the module's real public interface surface" without knowing its actual shape — the
 * generator never reads commercial source, so it cannot know real export names; a catch-all
 * runtime proxy is the honest stub for an unknown surface, never a guessed one.
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
 * Description:  ${entry.description}
 * Dependencies: ${deps}
 */

function demoStub(moduleId: string): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_target: object, prop: string | symbol): unknown {
        if (typeof prop !== "string") return undefined;
        return (..._args: unknown[]): never => {
          throw new Error(
            "CAISSON DEMO STUB: " +
              moduleId +
              "." +
              prop +
              "() is not implemented — this is a demo scaffold, not the licensed module. Get a " +
              "license at https://caisson.sh",
          );
        };
      },
    },
  ) as Record<string, unknown>;
}

/** Every import from this module resolves here — every call throws the CAISSON DEMO STUB marker. */
export default demoStub(${JSON.stringify(entry.id)});
`;
  return { path: stubPath(entry.id), content };
}

// The base README's licensed-install instruction (`templates/base/README.md`) is WRONG in demo
// mode — there is no `.npmrc`, no token, and half the listed modules were never installed at all.
// Swapped for the demo-accurate note wherever it appears (a no-op replace if the base template
// text ever drifts — the banner still lands, just without the swap).
const REGISTRY_INSTALL_NOTE =
  "Install from `registry.caisson.sh` with your license token in `CAISSON_LICENSE_TOKEN`\n" +
  "(see `.npmrc`).";
const DEMO_INSTALL_NOTE =
  "Free (Apache-2.0) modules above install from the public npm registry — no license needed. " +
  "Commercial modules are local stubs under `src/demo-stubs/` (see DEMO.md), not installed " +
  "dependencies. Get a license at https://caisson.sh to install the real thing.";

/** Prepend the demo watermark to an existing doc file's content (README.md/AGENTS.md), and swap
 *  the licensed-install instruction for the demo-accurate one where present. */
function withDemoBanner(markdown: string): string {
  const rewritten = markdown.includes(REGISTRY_INSTALL_NOTE)
    ? markdown.replace(REGISTRY_INSTALL_NOTE, DEMO_INSTALL_NOTE)
    : markdown;
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
      "modules below install for real from the public npm registry; every commercial module is a " +
      "local stub under `src/demo-stubs/` — not the licensed source, never for production.",
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

/** Strip every paid-tier module from `dependencies` (no CAISSON_LICENSE_TOKEN install for a
 *  stub) and mark the package as demo-generated. */
function stripPaidDependencies(
  pkgContent: string,
  paidIds: ReadonlySet<string>,
): string {
  const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
  const deps =
    (pkg["dependencies"] as Record<string, string> | undefined) ?? {};
  const kept = Object.fromEntries(
    Object.entries(deps).filter(([id]) => !paidIds.has(id)),
  );
  const next = { ...pkg, dependencies: kept, caissonDemo: true };
  return `${JSON.stringify(next, null, 2)}\n`;
}

/**
 * Materialize the demo project: the same `base` templated scaffold `generate()` produces for a
 * licensed build, composed over the FULL registry catalog, then post-processed so no commercial
 * source is ever required or delivered:
 *  - `.npmrc` (the commercial-registry auth line) is dropped — nothing here needs it.
 *  - every paid-tier module is removed from `package.json` `dependencies` and replaced by a local
 *    stub file under `src/demo-stubs/`.
 *  - oss modules are untouched — they install for real, exactly like a licensed build.
 *  - README.md/AGENTS.md gain the not-for-production banner; a root DEMO.md lists the full catalog.
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
  byPath.delete(".npmrc");

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
