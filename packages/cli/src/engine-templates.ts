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

/** Human labels for the bundles (ADR-0257/0258), used in the rendered README/AGENTS prose. Keyed
 *  by the canonical bundle id — `Selection.edition` is normalized to one at the Zod boundary
 *  (`seam.ts`), so a legacy `--edition ai-kit` invocation renders identically to `ai-production`. */
const EDITION_LABELS: Record<NonNullable<Selection["edition"]>, string> = {
  compliance: "the Compliance edition",
  "ai-production": "the AI-Production edition",
  "local-first": "the Local-first edition",
  "agentic-dev": "the Agentic-Dev edition",
  provenance: "the Provenance edition",
  everything: "the Everything edition",
};

/** Canonical bundle id → its on-disk template overlay directory (sibling of `base` under
 *  `templates/`). The physical dirs still carry their original legacy slugs — renaming them is a
 *  content-only follow-up, not required for the vocabulary migration (ADR-0257/0258 renamed the
 *  buyer-facing id, not the template tree). `provenance` and `everything` are new bundles with no
 *  dedicated overlay yet: absent from this map, they compose base + the buyer's explicit
 *  `--module` selection only — identical to an edition-less build except for the recorded
 *  `caissonEdition`/label. */
const EDITION_TEMPLATE_DIR: Partial<
  Record<NonNullable<Selection["edition"]>, string>
> = {
  compliance: "compliance",
  "ai-production": "ai-kit",
  "local-first": "local-ai",
  "agentic-dev": "agent-dev",
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

/** The template dirs that compose a selection: `base` is always included, then the edition's
 *  overlay dir (if it has one — `EDITION_TEMPLATE_DIR`), then the framework starter (ADR-0287, if
 *  any), then the deploy-target family (ADR-0268, if any). Framework is composed BEFORE deploy so
 *  a framework's own `package.json` fragment (its `build`/`start` scripts) is what a co-selected
 *  deploy Dockerfile's generic `bun run build`/`bun run start` actually runs. Both are additive —
 *  a framework's root-file overrides (tsconfig.json/README.md/etc.) win over base/edition on path
 *  collision, and deploy only ever adds NEW paths — so unset composes nothing (byte-identical to
 *  pre-ADR-0268/pre-ADR-0287 output). */
function templateDirs(selection: Selection): string[] {
  const dirs = [join(TEMPLATES_ROOT, "base")];
  const editionDir = selection.edition
    ? EDITION_TEMPLATE_DIR[selection.edition]
    : undefined;
  if (editionDir !== undefined) {
    dirs.push(join(TEMPLATES_ROOT, editionDir));
  }
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
