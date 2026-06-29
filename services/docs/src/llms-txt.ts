// src/llms-txt.ts — render the canonical `llms.txt` index + `llms-full.txt` corpus (ADR-0096) from the
// built corpus. Format follows the llmstxt.org convention that stabilized across Mintlify/Fern/Stripe:
// one H1, a blockquote summary, H2 sections grouping `- [Title](URL): Description.` link lines, and an
// `## Optional` tail for deprioritizable pages. Deterministic: a fixed corpus → a byte-stable file.
import type { Corpus } from "./corpus.ts";
import type { DocChunk, DocPage } from "./types.ts";

const DEFAULT_ORIGIN = "https://caisson.sh";
const GITHUB_BLOB = "https://github.com/GridWork-dev/caisson/blob/main";
const FALLBACK_SUMMARY =
  "Compliance-grade infrastructure for regulated SaaS — a composable base substrate plus premium " +
  "editions, a create-caisson generator, and a support service. This is the machine-readable docs " +
  "corpus for agents.";

export interface RenderOptions {
  /** Origin for the human docs site links (default https://caisson.sh). */
  origin?: string;
}

/** Section title for an MDX doc, keyed on its top-level `content/docs/<dir>`; "" ⇒ general "Start here". */
function docSection(source: string): string {
  const after = source.split("content/docs/")[1] ?? "";
  const top = after.includes("/") ? (after.split("/")[0] ?? "") : "";
  const map: Record<string, string> = {
    "": "Start here",
    base: "Base substrate",
    compliance: "Compliance edition",
    "ai-kit": "AI Production Kit edition",
    "local-first": "Local-first AI edition",
    "agentic-dev": "Agentic-Dev edition",
    cli: "CLI",
  };
  return (
    map[top] ??
    (top ? top.charAt(0).toUpperCase() + top.slice(1) : "Start here")
  );
}

/** Fixed display order for the doc sections; anything else sorts after, alphabetically. */
const SECTION_ORDER = [
  "Start here",
  "Base substrate",
  "Compliance edition",
  "AI Production Kit edition",
  "Local-first AI edition",
  "Agentic-Dev edition",
  "CLI",
  "Package references",
];

/** Public URL for a page: docs → the docs site, READMEs → the GitHub blob (both fetchable markdown). */
function pageUrl(page: DocPage, origin: string): string {
  if (page.kind === "readme") return `${GITHUB_BLOB}/${page.source}`;
  const rel = (page.source.split("content/docs/")[1] ?? "").replace(
    /\.mdx$/,
    "",
  );
  const slug = rel.replace(/(?:^|\/)index$/, "");
  return slug ? `${origin}/docs/${slug}` : `${origin}/docs`;
}

function linkLine(page: DocPage, origin: string): string {
  const desc = page.description
    ? ` ${page.description.replace(/\s+/g, " ").trim()}`
    : "";
  const tail = desc && !/[.!?]$/.test(desc) ? "." : "";
  return `- [${page.title}](${pageUrl(page, origin)}):${desc}${tail}`;
}

/**
 * Render `llms.txt`: H1 + blockquote summary + H2 link sections. Pages are grouped by section (docs by
 * their docs subtree, READMEs under "Package references") in a fixed order; links within a section are
 * sorted by source for determinism.
 */
export function renderLlmsTxt(
  corpus: Corpus,
  opts: RenderOptions = {},
): string {
  const origin = opts.origin ?? DEFAULT_ORIGIN;
  const summary =
    corpus.pages.find((p) => p.source.endsWith("content/docs/index.mdx"))
      ?.description || FALLBACK_SUMMARY;

  const groups = new Map<string, DocPage[]>();
  for (const page of corpus.pages) {
    const section =
      page.kind === "readme" ? "Package references" : docSection(page.source);
    const bucket = groups.get(section) ?? [];
    bucket.push(page);
    groups.set(section, bucket);
  }

  const orderedSections = [...groups.keys()].sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const lines: string[] = ["# Caisson", "", `> ${summary}`, ""];
  for (const section of orderedSections) {
    const pages = (groups.get(section) ?? []).sort((a, b) =>
      a.source.localeCompare(b.source),
    );
    lines.push(`## ${section}`, "");
    for (const page of pages) lines.push(linkLine(page, origin));
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render `llms-full.txt`: the full corpus concatenated for single-fetch ingestion. Each page is a
 * header (title + source) followed by its chunks in order. Deterministic — page order matches the
 * corpus, chunk order matches the build.
 */
export function renderLlmsFull(corpus: Corpus): string {
  const bySource = new Map<string, DocChunk[]>();
  for (const chunk of corpus.chunks) {
    const bucket = bySource.get(chunk.source) ?? [];
    bucket.push(chunk);
    bySource.set(chunk.source, bucket);
  }
  const blocks: string[] = [];
  for (const page of corpus.pages) {
    const chunks = bySource.get(page.source) ?? [];
    if (chunks.length === 0) continue;
    blocks.push(
      `# ${page.title}\n<!-- source: ${page.source} -->\n\n${chunks.map((c) => c.text).join("\n\n")}`,
    );
  }
  return `${blocks.join("\n\n---\n\n").trimEnd()}\n`;
}
