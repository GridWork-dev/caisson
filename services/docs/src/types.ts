// src/types.ts — the corpus contract (ADR-0096). Zod `.strict()` at the boundary; inferred TS types.
// A DocChunk is one self-contained, retrievable idea (a doc section), carrying the metadata an agent
// needs to cite it (source path, title, section heading, owning package, SPDX license). ScoredChunk is
// what `POST /query` returns: a chunk plus its RRF score. These shapes ARE the cross-language contract
// the (Python) support-bot consumes, so they are validated, not just typed.
import { z } from "zod";

/**
 * What kind of authoritative source a chunk came from. ADDITIVE ONLY (ADR-0234 F4): appending a
 * member (e.g. `pricing`) is forward-compatible — existing `docs`/`readme` chunks still validate and
 * every existing consumer keeps working. The Python mirror (`services/support-bot` `contracts.py`
 * `DocKind`) must gain the same member so a new-kind chunk in a `/query` result still parses there.
 * `pricing` = a fact rendered deterministically FROM the pricebook/catalog source of truth (never
 * scraped page text), so a cited price cannot silently drift stale.
 */
export const DocKindSchema = z.enum(["docs", "readme", "pricing"]);
export type DocKind = z.infer<typeof DocKindSchema>;

/**
 * One retrievable unit of documentation — a single heading-scoped section, kept self-contained (the
 * heading is preserved in `text`) so a retriever can return it without surrounding context (Fern's
 * RAG chunking guidance). `id` is a deterministic content hash so a rebuilt corpus is byte-stable.
 */
export const DocChunkSchema = z
  .object({
    /** Stable id = sha256(source + '#' + section)[:16] — deterministic across rebuilds. */
    id: z.string().min(1),
    /** Repo-relative source path, e.g. `apps/site/content/docs/base/billing.mdx`. */
    source: z.string().min(1),
    /** Human title for the source (frontmatter `title`, or the package name for a README). */
    title: z.string().min(1),
    /** The section heading this chunk is scoped to ("" for the lead/preamble chunk). */
    section: z.string(),
    /** Which authoritative surface it came from. */
    kind: DocKindSchema,
    /** Owning `@caisson/*` package when derivable from the source path, else undefined. */
    pkg: z.string().min(1).optional(),
    /** SPDX license of the source tree (Apache-2.0 for open base docs, commercial otherwise). */
    license: z.string().min(1),
    /** The chunk body (heading-prefixed markdown text). */
    text: z.string().min(1),
  })
  .strict();
export type DocChunk = z.infer<typeof DocChunkSchema>;

/** A retrieval hit: the chunk plus its fused RRF score (higher = better). */
export const ScoredChunkSchema = DocChunkSchema.extend({
  score: z.number(),
}).strict();
export type ScoredChunk = z.infer<typeof ScoredChunkSchema>;

/**
 * Page-level metadata for one source file — what `llms.txt` lists (`- [Title](URL): Description.`).
 * Distinct from a chunk: a page is the whole doc, a chunk is one section of it. `url` is derived at
 * render time from `source` + the site origin, so it is not stored here.
 */
export interface DocPage {
  source: string;
  title: string;
  description: string;
  kind: DocKind;
  pkg?: string;
  license: string;
}

/** A source file queued for chunking, with the metadata the chunker can't infer from the body. */
export interface DocsSource {
  source: string;
  kind: DocKind;
  pkg?: string;
  license: string;
  /** Fallback title when the body has no frontmatter `title` (e.g. a package name for a README). */
  fallbackTitle: string;
  raw: string;
}
