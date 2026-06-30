// src/chunk.ts — markdown/MDX → DocChunk[] (ADR-0096). Deterministic, pure: a fixed source yields a
// byte-stable page + chunk set (ids are content hashes, never iteration-derived). Chunking is by
// heading section (one complete idea per chunk, the Fern RAG guidance) with the heading PRESERVED in
// the chunk text so a retrieved chunk is self-contained. This is a pragmatic markdown splitter, not a
// full MDX AST — the corpus is retrieval text, not a render tree, so frontmatter + JSX noise are
// stripped by regex and the prose is kept.
import { createHash } from "node:crypto";
import type { DocChunk, DocPage, DocsSource } from "./types.ts";

/** Hard cap on a single chunk; an over-long section is split on blank lines, heading re-prefixed. */
const MAX_CHUNK_CHARS = 4000;
/** Unicode BOM — stripped before parsing so a leading byte-order mark never breaks the frontmatter match. */
const BOM = 0xfeff;

interface Frontmatter {
  title?: string;
  description?: string;
  body: string;
}

/** Split a leading `---\n…\n---` YAML-ish frontmatter block; capture `title`/`description` only. */
function parseFrontmatter(raw: string): Frontmatter {
  const clean = raw.charCodeAt(0) === BOM ? raw.slice(1) : raw;
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(clean);
  if (!match) return { body: clean };
  const block = match[1] ?? "";
  const body = clean.slice(match[0].length);
  const field = (name: string): string | undefined => {
    const m = new RegExp(`^${name}:\\s*(.+)$`, "m").exec(block);
    if (!m || m[1] === undefined) return undefined;
    return m[1].trim().replace(/^["']|["']$/g, "");
  };
  const out: Frontmatter = { body };
  const title = field("title");
  const description = field("description");
  if (title !== undefined) out.title = title;
  if (description !== undefined) out.description = description;
  return out;
}

/** Strip MDX/JSX noise that carries no retrieval signal: import/export lines + JSX tags. */
function stripMdx(body: string): string {
  return body
    .replace(/^(?:import|export)\s.*$/gm, "") // ESM import/export statements
    .replace(/<\/?[A-Z][A-Za-z0-9]*(?:\s[^>]*)?\/?>/g, "") // JSX component tags
    .replace(/\n{3,}/g, "\n\n") // collapse the blank runs those leave behind
    .trim();
}

/** First non-empty prose line, trimmed of markdown emphasis — the llms.txt description fallback. */
function firstSentence(body: string): string {
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#") && !t.startsWith(">")) {
      const sentence = /^(.*?[.!?])(\s|$)/.exec(t);
      return (sentence?.[1] ?? t).replace(/[*_`]/g, "").slice(0, 200);
    }
  }
  return "";
}

interface Section {
  heading: string;
  text: string;
}

/** Split a body into `##`/`###` sections; text before the first heading is the lead (heading ""). */
function splitSections(body: string): Section[] {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let heading = "";
  let buf: string[] = [];
  const flush = (): void => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ heading, text });
    buf = [];
  };
  for (const line of lines) {
    const h = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      heading = (h[2] ?? "").trim();
      buf.push(line); // keep the heading line IN the chunk text (self-contained)
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/** Cap an over-long section into ≤MAX_CHUNK_CHARS pieces on blank-line boundaries, heading re-prefixed. */
function capSection(section: Section): string[] {
  if (section.text.length <= MAX_CHUNK_CHARS) return [section.text];
  const headingLine = section.heading ? `## ${section.heading}` : "";
  const paras = section.text.split(/\n\n+/);
  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  const flush = (): void => {
    if (cur.length === 0) return;
    const joined = cur.join("\n\n");
    out.push(
      headingLine && !joined.startsWith("#")
        ? `${headingLine}\n\n${joined}`
        : joined,
    );
    cur = [];
    len = 0;
  };
  for (const p of paras) {
    if (len + p.length > MAX_CHUNK_CHARS && cur.length > 0) flush();
    cur.push(p);
    len += p.length + 2;
  }
  flush();
  return out;
}

function chunkId(source: string, section: string, ordinal: number): string {
  return createHash("sha256")
    .update(`${source}#${section}#${ordinal}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Parse one source into its page metadata + chunk list. Deterministic: same input → identical output,
 * ids included. The page feeds `llms.txt`; the chunks feed the retriever.
 */
export function parseSource(src: DocsSource): {
  page: DocPage;
  chunks: DocChunk[];
} {
  const fm = parseFrontmatter(src.raw);
  const body = stripMdx(fm.body);
  const title = (fm.title ?? src.fallbackTitle).trim() || src.fallbackTitle;
  const description = (fm.description ?? firstSentence(body)).trim();

  const page: DocPage = {
    source: src.source,
    title,
    description,
    kind: src.kind,
    license: src.license,
    ...(src.pkg !== undefined ? { pkg: src.pkg } : {}),
  };

  const chunks: DocChunk[] = [];
  for (const section of splitSections(body)) {
    const pieces = capSection(section);
    pieces.forEach((text, i) => {
      chunks.push({
        id: chunkId(src.source, section.heading, i),
        source: src.source,
        title,
        section: section.heading,
        kind: src.kind,
        license: src.license,
        text,
        ...(src.pkg !== undefined ? { pkg: src.pkg } : {}),
      });
    });
  }
  return { page, chunks };
}
