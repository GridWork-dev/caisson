// The real templated generator engine (ADR-0068/0072). Reads an in-repo template SCAFFOLD
// tree (degit-pattern, NO network), applies the token-replace + deep-merge transform
// (`replaceTokens` + `deepMerge`) with tokens derived from the validated `Selection`, and returns a
// deterministic, sorted
// `GeneratedFileSet`. Pure construction: reads template files from disk (resolved via
// `import.meta.url`, NEVER from caller input) and never writes, fetches, or spawns.
//
// The emitted tree is exactly what ADR-0072 lets cross into a generated repo: a trimmed CI
// (build · lint · unit · golden), the base golden fixture, `AGENTS.md`, and the standard config
// files — and NONE of Caisson's monorepo-internal machinery (the registry/publish flow, the
// standards-gate authoring scanner, the eval CI gate). Modules install from public npm, so no
// registry-scope `.npmrc` is emitted.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratedFile,
  GeneratedFileSet,
  GeneratorEngine,
  Selection,
} from "./seam.ts";
import { type JsonObject, deepMerge, replaceTokens } from "./transform.ts";

/** Absolute path to the in-repo template tree (sibling of `src/`, resolved from this module). */
export const TEMPLATES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
);

/** One template directory's worth of raw (pre-token) files, keyed by POSIX-relative path. */
export interface RawTemplateFile {
  /** Path relative to the template root, always `/`-separated (deterministic across platforms). */
  readonly rel: string;
  readonly content: string;
}

/**
 * Recursively read every file under `root`, returning POSIX-relative paths. Directory entries are
 * walked in sorted order so the read order is deterministic regardless of filesystem enumeration.
 * `root` is always a fixed in-repo path (`base` or an opt-in overlay) — never user input.
 */
export function readTemplateDir(root: string): RawTemplateFile[] {
  const out: RawTemplateFile[] = [];
  const walk = (absDir: string, prefix: string): void => {
    const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    );
    for (const entry of entries) {
      const abs = join(absDir, entry.name);
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else {
        out.push({ rel, content: readFileSync(abs, "utf8") });
      }
    }
  };
  walk(root, "");
  return out;
}

/** The token map for a selection — `{{projectName}}`, `{{moduleList}}`. */
function tokensFor(selection: Selection): Record<string, string> {
  const moduleList = [...selection.modules]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((m) => `- \`${m.id}\` @ ${m.version}`)
    .join("\n");
  return {
    projectName: selection.projectName,
    moduleList,
  };
}

/**
 * The `package.json` overlay derived from the selection: the installed modules become sorted
 * `dependencies`. Deep-merged LAST, over the base (and any overlay) `package.json` fragments.
 */
function packageOverlay(selection: Selection): JsonObject {
  const dependencies: Record<string, string> = {};
  for (const m of [...selection.modules].sort((a, b) =>
    a.id < b.id ? -1 : 1,
  )) {
    dependencies[m.id] = m.version;
  }
  return { dependencies };
}

/** The template dirs that compose a selection: `base` is always included, then the framework
 *  starter (ADR-0287, if any), then the deploy-target family (ADR-0268, if any). Framework is
 *  composed BEFORE deploy so a framework's own `package.json` fragment (its `build`/`start`
 *  scripts) is what a co-selected deploy Dockerfile's generic `bun run build`/`bun run start`
 *  actually runs. Both are additive — a framework's root-file overrides (tsconfig.json/README.md/
 *  etc.) win over base on path collision, and deploy only ever adds NEW paths — so unset composes
 *  nothing. */
function templateDirs(selection: Selection): string[] {
  const dirs = [join(TEMPLATES_ROOT, "base")];
  if (selection.framework) {
    dirs.push(join(TEMPLATES_ROOT, "framework", selection.framework));
  }
  if (selection.deployTarget) {
    dirs.push(join(TEMPLATES_ROOT, "deploy", selection.deployTarget));
  }
  return dirs;
}

/**
 * The real templated engine (ADR-0068). For a fixed selection it produces a deterministic, sorted
 * file set: token-substituted scaffold files, with `package.json` deep-merged across every template
 * `package.json` fragment plus the selection overlay (so deps land last-and-sorted). On a path
 * collision the later overlay wins — except `package.json`, which is always deep-merged, never
 * overridden.
 */
export const templatesEngine: GeneratorEngine = {
  materialize(selection: Selection): GeneratedFileSet {
    const tokens = tokensFor(selection);
    const byPath = new Map<string, string>();
    const packageFragments: JsonObject[] = [];

    for (const dir of templateDirs(selection)) {
      for (const { rel, content } of readTemplateDir(dir)) {
        const { content: rendered } = replaceTokens(content, tokens);
        if (rel === "package.json") {
          packageFragments.push(JSON.parse(rendered) as JsonObject);
        } else {
          byPath.set(rel, rendered); // a later overlay overrides base on collision
        }
      }
    }

    // package.json: deep-merge every fragment (base → overlays), then the selection overlay last.
    let pkg: JsonObject = {};
    for (const fragment of packageFragments) {
      pkg = deepMerge(pkg, fragment);
    }
    pkg = deepMerge(pkg, packageOverlay(selection));
    byPath.set("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

    const files: GeneratedFile[] = [...byPath.entries()].map(
      ([path, content]) => ({ path, content }),
    );
    return [...files].sort((a, b) => (a.path < b.path ? -1 : 1));
  },
};
