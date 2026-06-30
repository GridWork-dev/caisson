// src/corpus.ts — assemble the corpus from the repo's authoritative docs (ADR-0096). Two surfaces:
// the curated Fumadocs MDX (`apps/site/content/docs`) and each package's README. Deterministic: every
// directory walk is sorted, so a rebuilt corpus is byte-identical. Default surface is buyer-facing
// PUBLIC docs only — ADRs/specs (internal decision records) are intentionally excluded from the
// agent corpus. No DB, no network: pure filesystem → DocChunk[] + DocPage[].
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseSource } from "./chunk.ts";
import type { DocChunk, DocPage, DocsSource } from "./types.ts";

const APACHE = "Apache-2.0";
const COMMERCIAL = "LicenseRef-Caisson-Commercial";

/** Top-level `content/docs` dirs whose prose documents the open Apache-2.0 base substrate. */
const OPEN_DOC_ROOTS = new Set(["base"]);
/** Top-level general docs (not under any edition dir) that describe the open project overall. */
const OPEN_DOC_FILES = new Set(["index.mdx", "getting-started.mdx"]);

export interface BuildCorpusOptions {
  /** Repo root. Defaults to the resolved workspace root (the package.json declaring `workspaces`). */
  root?: string;
}

export interface Corpus {
  chunks: DocChunk[];
  pages: DocPage[];
}

/** Walk up to the dir whose package.json declares `workspaces` (the monorepo root). */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      try {
        if (Array.isArray(JSON.parse(readFileSync(pj, "utf8")).workspaces))
          return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = join(dir, "..");
    if (parent === dir)
      throw new Error("repo root (package.json with `workspaces`) not found");
    dir = parent;
  }
}

/** Recursively list files under `dir` matching `ext`, returned repo-relative and SORTED. */
function listFiles(root: string, dir: string, ext: string): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs).sort()) {
    const relChild = join(dir, name);
    const absChild = join(root, relChild);
    if (statSync(absChild).isDirectory())
      out.push(...listFiles(root, relChild, ext));
    else if (name.endsWith(ext)) out.push(relChild);
  }
  return out;
}

/** License for an MDX doc, keyed on its `content/docs/<...>` path (open base vs commercial edition). */
function docLicense(rel: string): string {
  const after = rel.split("content/docs/")[1] ?? "";
  const top = after.split("/")[0] ?? "";
  if (OPEN_DOC_FILES.has(after) || OPEN_DOC_ROOTS.has(top)) return APACHE;
  return COMMERCIAL;
}

/** `@caisson/<x>` for a `content/docs/base/<x>.mdx` doc; undefined for edition/general docs. */
function docPkg(rel: string): string | undefined {
  const after = rel.split("content/docs/")[1] ?? "";
  const m = /^base\/([^/]+)\.mdx$/.exec(after);
  return m ? `@caisson/${m[1]}` : undefined;
}

function readPackageJson(abs: string): { name?: string; license?: string } {
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as {
      name?: string;
      license?: string;
    };
  } catch {
    return {};
  }
}

/** Enumerate the MDX docs + package READMEs as chunk-ready sources, in deterministic order. */
function gatherSources(root: string): DocsSource[] {
  const sources: DocsSource[] = [];

  for (const rel of listFiles(root, "apps/site/content/docs", ".mdx")) {
    const pkg = docPkg(rel);
    sources.push({
      source: rel,
      kind: "docs",
      license: docLicense(rel),
      fallbackTitle: basename(rel, ".mdx"),
      raw: readFileSync(join(root, rel), "utf8"),
      ...(pkg !== undefined ? { pkg } : {}),
    });
  }

  const pkgRoot = join(root, "packages");
  if (existsSync(pkgRoot)) {
    for (const name of readdirSync(pkgRoot).sort()) {
      const readme = join(pkgRoot, name, "README.md");
      if (!existsSync(readme)) continue;
      const pj = readPackageJson(join(pkgRoot, name, "package.json"));
      sources.push({
        source: join("packages", name, "README.md"),
        kind: "readme",
        license: pj.license ?? COMMERCIAL,
        fallbackTitle: pj.name ?? `@caisson/${name}`,
        raw: readFileSync(readme, "utf8"),
        ...(pj.name !== undefined ? { pkg: pj.name } : {}),
      });
    }
  }

  return sources;
}

/**
 * Build the corpus: gather authoritative sources, chunk each, and collect page metadata. Deterministic
 * and offline. The returned `chunks` feed the retriever; `pages` feed `llms.txt`.
 */
export function buildCorpus(opts: BuildCorpusOptions = {}): Corpus {
  const root = opts.root ?? findRepoRoot(process.cwd());
  const chunks: DocChunk[] = [];
  const pages: DocPage[] = [];
  for (const src of gatherSources(root)) {
    const { page, chunks: pageChunks } = parseSource(src);
    if (pageChunks.length === 0) continue; // skip an empty doc (no retrievable prose)
    pages.push(page);
    chunks.push(...pageChunks);
  }
  return { chunks, pages };
}
