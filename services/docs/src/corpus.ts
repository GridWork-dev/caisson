// src/corpus.ts — assemble the corpus from the repo's authoritative docs (ADR-0096). Two surfaces:
// the curated Fumadocs MDX (`apps/site/content/docs`) and each package's README. Deterministic: every
// directory walk is sorted, so a rebuilt corpus is byte-identical. Default surface is buyer-facing
// PUBLIC docs only — ADRs/specs (internal decision records) are intentionally excluded from the
// agent corpus. No DB, no network: pure filesystem → DocChunk[] + DocPage[].
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseSource } from "./chunk.ts";
import { generatePricingSources, PricingFactsSchema } from "./pricing-doc.ts";
import type { PricingFacts } from "./pricing-doc.ts";
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
  /**
   * ADR-0234 F4 — pricing/edition/module facts, validated from the pricebook/catalog source of truth.
   * When present, `generatePricingSources` renders deterministic `kind:"pricing"` docs and appends them
   * to the corpus. Omitted ⇒ the docs-only corpus (byte-identical to every existing caller). Load the
   * real facts off disk with `loadPricingFacts` (the one impure stage); tests inject fixtures directly.
   */
  pricingFacts?: PricingFacts;
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
        // `workspaces` is either the legacy bare array or the bun-catalog object form
        // (`{ packages: [...], catalog: {...} }`, ADR-program row #4).
        const ws = JSON.parse(readFileSync(pj, "utf8")).workspaces;
        if (Array.isArray(ws) || Array.isArray(ws?.packages)) return dir;
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

/** `undefined` on a missing/unparseable `package.json` — the caller fails closed (skips the package). */
function readPackageJson(
  abs: string,
): { name?: string; license?: string; private?: boolean } | undefined {
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as {
      name?: string;
      license?: string;
      private?: boolean;
    };
  } catch {
    return undefined;
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
      // Buyer-facing corpus only: a private package is never published to buyers, so its README never
      // enters the public corpus. Fail closed — a missing/unparseable package.json skips the package
      // too, since we can't confirm it's safe to publish.
      if (pj === undefined || pj.private === true) continue;
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
  const sources = gatherSources(root);
  // ADR-0234 F4: append the generated pricing docs (if facts were supplied) so they chunk through the
  // exact same path as every filesystem source — pricing chunks are ordinary DocChunks, kind "pricing".
  if (opts.pricingFacts !== undefined)
    sources.push(...generatePricingSources(opts.pricingFacts));
  for (const src of sources) {
    const { page, chunks: pageChunks } = parseSource(src);
    if (pageChunks.length === 0) continue; // skip an empty doc (no retrievable prose)
    pages.push(page);
    chunks.push(...pageChunks);
  }
  return { chunks, pages };
}

/**
 * Load the live pricing facts from the display source of truth (`apps/site/lib/pricing.ts`) and
 * validate them into `PricingFacts` (ADR-0234 F4). This is the ONE impure stage of pricing-doc
 * generation: it reads the SOT's committed data structures — NOT scraped page text — so a pricebook
 * change is reflected the next time the corpus is built (a stale cited price is impossible by
 * construction). Returns `null` when the SOT file is absent (e.g. a docs-only deploy); a shape drift
 * throws (the caller degrades to the docs-only corpus rather than crash-looping). The module path is
 * resolved at runtime (dynamic import) both because it lives outside this package's `rootDir` and so a
 * price edit needs no rebuild here — the container ships the whole repo and Bun runs the TS directly.
 */
export async function loadPricingFacts(
  opts: BuildCorpusOptions = {},
): Promise<PricingFacts | null> {
  const root = opts.root ?? findRepoRoot(process.cwd());
  const pricingPath = join(root, "apps/site/lib/pricing.ts");
  if (!existsSync(pricingPath)) return null;
  const mod = await import(pricingPath);
  // `renewal` is the one projected field — the SOT exposes it as a FUNCTION (`renewalAmount`, the
  // ADR-0260 §5 40%-floored-to-X9 ladder), not as a field on each row, so it is evaluated here
  // rather than read. Same discipline as every other fact: computed from the SOT, never typed in.
  const withRenewal = (rows: unknown): unknown =>
    Array.isArray(rows)
      ? rows.map((r: { id?: unknown }) => ({
          ...r,
          renewal: mod.renewalAmount(String(r.id)),
        }))
      : rows;
  return PricingFactsSchema.parse({
    bundles: withRenewal(mod.BUNDLE_PRICES),
    modules: mod.MODULE_PRICES,
    plans: mod.PLAN_PRICES,
  });
}
