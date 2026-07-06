// The real templated generator engine (ADR-0068/0072). Reads an in-repo template SCAFFOLD
// tree (degit-pattern, NO network), applies the token-replace + deep-merge transform
// (`replaceTokens` + `deepMerge`) with tokens derived from the validated `Selection`, and returns a
// deterministic, sorted
// `GeneratedFileSet`. Pure construction: reads template files from disk (resolved via
// `import.meta.url`, NEVER from caller input) and never writes, fetches, or spawns.
//
// The emitted tree is exactly what ADR-0072 lets cross into a buyer repo: a trimmed CI
// (build · lint · unit · golden), the included modules' golden fixtures, `AGENTS.md`, and the
// standard config files — and NONE of Caisson's monorepo-internal machinery (the registry/publish
// flow, the standards-gate authoring scanner, the eval CI gate).
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

/** Absolute path to the in-repo template tree (sibling of `src/`, resolved from this module).
 *  Exported so the free-sample engine (`sample-templates.ts`, ADR-0095 W3) shares the same root +
 *  reader instead of re-deriving them — the two generator paths stay mechanically consistent even
 *  though samples are NOT composed through `Selection`/the paid registry allowlist. */
export const TEMPLATES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
);

/** Human labels for the editions, used in the rendered README/AGENTS prose. */
const EDITION_LABELS: Record<NonNullable<Selection["edition"]>, string> = {
  compliance: "the Compliance edition",
  "ai-kit": "the AI Production Kit edition",
  "local-ai": "the Local-first AI edition",
  "agent-dev": "the Agentic-Dev edition",
};

/** One template directory's worth of raw (pre-token) files, keyed by POSIX-relative path. */
export interface RawTemplateFile {
  /** Path relative to the template root, always `/`-separated (deterministic across platforms). */
  readonly rel: string;
  readonly content: string;
}

/**
 * Recursively read every file under `root`, returning POSIX-relative paths. Directory entries are
 * walked in sorted order so the read order is deterministic regardless of filesystem enumeration.
 * `root` is always a fixed in-repo path (`base` or an edition slug) — never user input.
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

/** The token map for a selection — `{{projectName}}`, `{{edition}}`, `{{editionLabel}}`, `{{moduleList}}`. */
function tokensFor(selection: Selection): Record<string, string> {
  const moduleList = [...selection.modules]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((m) => `- \`${m.id}\` @ ${m.version}`)
    .join("\n");
  return {
    projectName: selection.projectName,
    edition: selection.edition ?? "base",
    editionLabel: selection.edition
      ? EDITION_LABELS[selection.edition]
      : "the base composition",
    moduleList,
  };
}

/**
 * The `package.json` overlay derived from the selection: the installed modules become sorted
 * `dependencies`, and an editioned selection records its `caissonEdition`. Deep-merged LAST, over
 * the base (and any edition) `package.json` fragments.
 */
function packageOverlay(selection: Selection): JsonObject {
  const dependencies: Record<string, string> = {};
  for (const m of [...selection.modules].sort((a, b) =>
    a.id < b.id ? -1 : 1,
  )) {
    dependencies[m.id] = m.version;
  }
  return {
    ...(selection.edition ? { caissonEdition: selection.edition } : {}),
    dependencies,
  };
}

/** The template dirs that compose a selection: `base` is always included, then the edition (if
 *  any), then the deploy-target family (ADR-0268, if any) — new paths only, so it never collides
 *  with base/edition files; unset composes nothing (byte-identical to pre-ADR-0268 output). */
function templateDirs(selection: Selection): string[] {
  const dirs = [join(TEMPLATES_ROOT, "base")];
  if (selection.edition) {
    dirs.push(join(TEMPLATES_ROOT, selection.edition));
  }
  if (selection.deployTarget) {
    dirs.push(join(TEMPLATES_ROOT, "deploy", selection.deployTarget));
  }
  return dirs;
}

/**
 * The real templated engine (ADR-0068). For a fixed selection it produces a deterministic, sorted
 * file set: token-substituted scaffold files, with `package.json` deep-merged across every template
 * `package.json` fragment plus the selection overlay (so deps + edition land last-and-sorted).
 * On a path collision between `base` and the edition, the edition wins (override) — except
 * `package.json`, which is always deep-merged, never overridden.
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
          byPath.set(rel, rendered); // edition overrides base on collision
        }
      }
    }

    // package.json: deep-merge every fragment (base → edition), then the selection overlay last.
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
