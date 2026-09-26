// A static source-graph walker for browser-safety proofs, shared by poke/component tests that
// need to prove a client entry never reaches a node builtin — across package boundaries.
//
// WHY A STATIC SOURCE WALK AND NOT A BUILD: a bundler does not fail on a node builtin, it
// SUBSTITUTES one. `import { createHash } from "node:crypto"` in a browser graph makes turbopack
// swap in crypto-browserify and the client chunk silently grows by ~428KB of polyfill, exit 0,
// no warning. "The site build would catch it" is false — the taint has to be caught in the
// source graph, before a bundler papers over it. (packages/kernel's browser-safety.test.ts —
// whose package-local copy this walk absorbed — asserts the same contract through this module;
// beyond that copy it resolves workspace `@caisson-sh/*` specifiers through each package's exports
// map, so a walk can start at an apps/site client component and follow the graph INTO the
// packages it drives.)
//
// KNOWN BLIND SPOTS (static regex walk): `require()`, `await import(...)`, and computed
// specifiers are invisible; a `Buffer`/`process` global is not an import at all. Consumers pin
// non-vacuity with positive controls (walk a known-tainted entry) and by asserting `unresolved`
// is empty — an edge this walker could not follow is reported, never silently dropped, because
// a skipped edge is indistinguishable from a clean one.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Every `import`/`export … from "<spec>"` statement, with the type-only modifier captured. An
 * `import type` / `export type` statement is erased at emit and puts nothing in a bundle graph.
 * NOTE the modifier is only recognized in the STATEMENT-LEVEL form — an inline
 * `import { type X } from "y"` is reported as a value edge, deliberately: consumers assert the
 * statement-level form in source so erasure stays a compiler guarantee (`verbatimModuleSyntax`),
 * not a convention. `[^;]*?` spans newlines; the `^[ \t]*` anchor keeps comment lines from matching.
 */
const FROM_STATEMENT =
  /^[ \t]*(?:import|export)[ \t]+(type[ \t]+)?[^;]*?from[ \t]*["']([^"']+)["']/gm;

/** A side-effect import (`import "./x.ts";`) — no clause, but it still pulls the module in. */
const BARE_IMPORT = /^[ \t]*import[ \t]*["']([^"']+)["']/gm;

/** Non-code assets a bundler handles out-of-band — they cannot import a node builtin. */
const ASSET_SPEC = /\.(?:css|svg|png|jpe?g|gif|webp|avif|ico|woff2?|txt|md)$/;

interface Ref {
  readonly spec: string;
  readonly typeOnly: boolean;
}

export interface TaintOffender {
  /** Path relative to the workspace root, so a failure names a file a reader can open. */
  readonly file: string;
  readonly spec: string;
}

export interface TaintWalk {
  /** Every source file the value-import graph reached, workspace-root-relative. */
  readonly files: readonly string[];
  /** Every `node:` specifier reached, with the importing file. */
  readonly offenders: readonly TaintOffender[];
  /** Sorted unique non-workspace package names left unwalked (react, zod, …). */
  readonly external: readonly string[];
  /**
   * Every edge the resolver DECLINED, as `"<importer> -> <spec>"`. A relative specifier that
   * resolves to no file, a workspace package whose exports map lacks the subpath, or an exports
   * target missing on disk all land here. Consumers assert this is empty — otherwise the
   * zero-offender claim is not provably non-vacuous for the edges that were skipped.
   */
  readonly unresolved: readonly string[];
}

/**
 * Node-only GLOBALS. These are not imports, so {@link nodeBuiltinTaint} is structurally blind to
 * them — and a bundler is worse than blind: `Buffer` in a browser graph silently pulls in the
 * `buffer/` polyfill, exit 0, same failure mode as `node:crypto` → crypto-browserify. Any module
 * admitted to a `./browser` entry must therefore pass {@link nodeGlobalTaint} too.
 */
const NODE_GLOBAL = /\b(?:Buffer|process|__dirname|__filename|require)\b/;

/** A line that is entirely comment — prose naming `Buffer` is documentation, not a bundle edge. */
const COMMENT_LINE = /^[ \t]*(?:\/\/|\/\*|\*)/;

/**
 * Scan already-walked source files for node-only globals. Takes {@link TaintWalk.files} so the scan
 * covers exactly the graph the walk proved import-clean, never the whole package. Line-level, so an
 * inline `// Buffer` note on a code line is a (deliberate) false positive — rewrite the comment.
 */
export function nodeGlobalTaint(
  files: readonly string[],
  opts: { readonly workspaceRoot: string },
): readonly TaintOffender[] {
  const offenders: TaintOffender[] = [];
  for (const file of files) {
    const source = readFileSync(join(opts.workspaceRoot, file), "utf8");
    for (const line of source.split("\n")) {
      if (COMMENT_LINE.test(line)) continue;
      const hit = NODE_GLOBAL.exec(line);
      if (hit !== null) offenders.push({ file, spec: hit[0] });
    }
  }
  return offenders;
}

function refsOf(source: string): Ref[] {
  const refs: Ref[] = [];
  for (const m of source.matchAll(FROM_STATEMENT)) {
    refs.push({ spec: m[2]!, typeOnly: m[1] !== undefined });
  }
  for (const m of source.matchAll(BARE_IMPORT)) {
    refs.push({ spec: m[1]!, typeOnly: false });
  }
  return refs;
}

/** Resolve a relative specifier to a real source file, or null when it does not resolve in-tree. */
function resolveRel(fromDir: string, spec: string): string | null {
  const base = join(fromDir, spec);
  const candidates = /\.tsx?$/.test(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** name -> package dir, from the root package.json workspaces globs (single-level `*` only). */
function workspacePackages(workspaceRoot: string): ReadonlyMap<string, string> {
  const root = JSON.parse(
    readFileSync(join(workspaceRoot, "package.json"), "utf8"),
  ) as { workspaces: { packages: readonly string[] } };
  const dirs: string[] = [];
  for (const glob of root.workspaces.packages) {
    if (glob.endsWith("/*")) {
      const parent = join(workspaceRoot, glob.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const entry of readdirSync(parent)) dirs.push(join(parent, entry));
    } else {
      dirs.push(join(workspaceRoot, glob));
    }
  }
  const byName = new Map<string, string>();
  for (const dir of dirs) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const { name } = JSON.parse(readFileSync(manifest, "utf8")) as {
      name?: string;
    };
    if (name !== undefined) byName.set(name, dir);
  }
  return byName;
}

/** An exports entry is either a bare string or a conditions object — both shapes are live in
 *  this workspace (`@caisson-sh/ui`'s "./components" is a bare string). */
function exportsTarget(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null) {
    const conditions = entry as Record<string, unknown>;
    const target = conditions["bun"] ?? conditions["default"];
    return typeof target === "string" ? target : null;
  }
  return null;
}

/** Split a bare specifier into its package name and exports subpath key. */
function splitBare(spec: string): { name: string; subKey: string } {
  const parts = spec.split("/");
  const nameLen = spec.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, nameLen).join("/");
  const rest = parts.slice(nameLen).join("/");
  return { name, subKey: rest === "" ? "." : `./${rest}` };
}

/**
 * Walk the EMITTED (value) import graph from `entry`, collecting every `node:` specifier reached.
 * Type-only edges are not followed: they are erased, so they cannot taint a bundle. Workspace
 * `@caisson-sh/*` specifiers are followed through the target package's exports map (`bun` condition,
 * i.e. the src entry — tscn's per-file emit keeps the dist graph 1:1 with the src graph).
 */
export function nodeBuiltinTaint(
  entry: string,
  opts: { readonly workspaceRoot: string },
): TaintWalk {
  const { workspaceRoot } = opts;
  const workspace = workspacePackages(workspaceRoot);
  const seen = new Set<string>();
  const offenders: TaintOffender[] = [];
  const external = new Set<string>();
  const unresolved: string[] = [];
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const rel = relative(workspaceRoot, file);
    for (const ref of refsOf(readFileSync(file, "utf8"))) {
      if (ref.typeOnly) continue;
      if (ref.spec.startsWith("node:")) {
        offenders.push({ file: rel, spec: ref.spec });
        continue;
      }
      if (ASSET_SPEC.test(ref.spec)) continue;
      if (ref.spec.startsWith(".")) {
        const resolved = resolveRel(dirname(file), ref.spec);
        if (resolved === null) unresolved.push(`${rel} -> ${ref.spec}`);
        else stack.push(resolved);
        continue;
      }
      const { name, subKey } = splitBare(ref.spec);
      const pkgDir = workspace.get(name);
      if (pkgDir === undefined) {
        external.add(name);
        continue;
      }
      const manifest = JSON.parse(
        readFileSync(join(pkgDir, "package.json"), "utf8"),
      ) as { exports?: Record<string, unknown> };
      const target = exportsTarget(manifest.exports?.[subKey]);
      const resolved = target === null ? null : join(pkgDir, target);
      if (resolved === null || !existsSync(resolved)) {
        unresolved.push(`${rel} -> ${ref.spec}`);
        continue;
      }
      stack.push(resolved);
    }
  }
  return {
    files: [...seen].map((f) => relative(workspaceRoot, f)),
    offenders,
    external: [...external].sort(),
    unresolved,
  };
}
