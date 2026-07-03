// The docs retrieval client (ADR-0234 F7 / ADR-0096). `services/docs` POST /query is a server-to-server
// contract: Bearer-gated on DOCS_SERVICE_TOKEN, NO CORS header — a browser cannot call it, so this
// server-side module holds the token and fronts it. The token NEVER reaches the browser (server-only
// env). A retrieval failure (non-2xx / timeout / malformed body) throws DocsUnavailableError; the
// caller escalates rather than answering ungrounded (mirrors rag.py's DocsUnavailableError path).
import { z } from "zod";
import { fetchWithTimeout } from "@caisson/kernel";
import { docsRoute, pricingRoute } from "../shared.ts";

/** The retrieval hit shape returned by POST /query — mirrors services/docs `ScoredChunkSchema`
 * (types.ts). Validated at the boundary (`.strict()`) so a drifted contract fails here, not downstream.
 * `.passthrough()`? No — strict, matching the source contract exactly. `kind` MUST stay a superset of
 * services/docs `DocKindSchema` (types.ts) — a member missing here makes a chunk of that kind reject
 * `.strict()` and throw the WHOLE response array, hard-failing every question in the same /query batch,
 * not just the one touching that kind (the ADR-0234 F4 pricing-chunk regression). */
export const ScoredChunkSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    title: z.string().min(1),
    section: z.string(),
    kind: z.enum(["docs", "readme", "pricing"]),
    pkg: z.string().min(1).optional(),
    license: z.string().min(1),
    text: z.string().min(1),
    score: z.number(),
  })
  .strict();
export type ScoredChunk = z.infer<typeof ScoredChunkSchema>;

const QueryResponseSchema = z.object({ chunks: z.array(ScoredChunkSchema) });

/** Retrieval was unavailable — docs-api down, timed out, non-2xx, or returned a malformed body. The
 * caller escalates (never answers ungrounded). Carries no secret. */
export class DocsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocsUnavailableError";
  }
}

export interface RetrieveConfig {
  /** Full URL of services/docs POST /query (e.g. `https://docs-api.../query`). Server-only env. */
  readonly url: string;
  /** Bearer for POST /query (DOCS_SERVICE_TOKEN). Server-only — never sent to the browser. */
  readonly token: string;
  /** How many chunks to retrieve (docs contract bounds k to 1..20). */
  readonly k: number;
  /** Connect timeout in ms. */
  readonly timeoutMs?: number;
}

/**
 * Retrieve grounding chunks for a question. Throws DocsUnavailableError on any failure so the caller
 * escalates to the contact CTA rather than answering without grounding.
 */
export async function retrieveChunks(
  question: string,
  cfg: RetrieveConfig,
): Promise<ScoredChunk[]> {
  if (cfg.url.length === 0 || cfg.token.length === 0) {
    throw new DocsUnavailableError("docs retrieval is not configured");
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(
      cfg.url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: question, k: cfg.k }),
      },
      { timeoutMs: cfg.timeoutMs ?? 8_000 },
    );
  } catch {
    // AbortError (timeout) or network failure — never surface the underlying error (it can echo the
    // request, which carries the Bearer token).
    throw new DocsUnavailableError("docs retrieval request failed");
  }
  if (!res.ok) {
    throw new DocsUnavailableError(
      `docs retrieval returned ${String(res.status)}`,
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new DocsUnavailableError("docs retrieval returned a malformed body");
  }
  const parsed = QueryResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DocsUnavailableError(
      "docs retrieval returned an unexpected shape",
    );
  }
  return parsed.data.chunks;
}

const DOCS_CONTENT_PREFIX = "apps/site/content/docs/";
// services/docs pricing-doc.ts generates exactly these three sources, all citing the one marketing
// pricing page (there is no per-doc pricing sub-route).
const PRICING_SOURCE_PREFIX = "pricing/";

/**
 * Map a chunk `source` path to a clickable URL, or null when it is not a linkable page (e.g. a package
 * README, which Fumadocs does not host). Pure — the UI renders the returned link.
 * `apps/site/content/docs/base/billing.mdx` -> `/docs/base/billing`; a trailing `/index` collapses to
 * the section root; `pricing/editions|modules|plans` -> `/pricing` (ADR-0234 F4).
 */
export function sourceToDocUrl(source: string): string | null {
  if (source.startsWith(PRICING_SOURCE_PREFIX)) return pricingRoute;
  if (!source.startsWith(DOCS_CONTENT_PREFIX)) return null;
  let slug = source.slice(DOCS_CONTENT_PREFIX.length).replace(/\.mdx?$/, "");
  if (slug === "index") return docsRoute;
  slug = slug.replace(/\/index$/, "");
  return `${docsRoute}/${slug}`;
}

/** A citation the UI renders: the source path plus its docs URL (null when not linkable). */
export interface Citation {
  readonly source: string;
  readonly url: string | null;
}

/** Dedupe chunk sources (order-preserving) into the citation list carried on a resolved answer. */
export function toCitations(chunks: readonly { source: string }[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of chunks) {
    if (seen.has(c.source)) continue;
    seen.add(c.source);
    out.push({ source: c.source, url: sourceToDocUrl(c.source) });
  }
  return out;
}
