// Tier-1 detection primitives: pure, deterministic, zero-network, zero-LLM. Every watcher's
// change decision is one of these three shapes — a content hash, an Atom release tag, or a
// set difference of row ids — so each is a plain unit test over a fixture.
import { createHash } from "node:crypto";

/** Collapse insignificant whitespace so a reflow / re-indent doesn't read as a content change. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Stable sha256 (hex) of the normalized text. Always returns a hash, including for empty text —
 *  used for stable KEY-BUILDING (e.g. `competitor.ts`'s `urlKey`), never directly for change
 *  detection (see `detectionHash` below for that). */
export function contentHash(text: string): string {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

/**
 * The change-detection hash: empty/whitespace-only text is "no signal", not "the content is now
 * empty" — returns `null` so a transient 200 with an empty/challenge/maintenance body can never
 * read as a change nor silently overwrite a stored baseline (the false-flood failure mode: a real
 * fetch right after would then see every real row/byte as "new"). Every hash-mode detection call
 * site (compliance's EU AI Act sources, soc2, competitor) goes through this, not `contentHash`
 * directly, so the guard lives once instead of once per caller.
 */
export function detectionHash(text: string): string | null {
  const normalized = normalize(text);
  return normalized.length === 0 ? null : contentHash(text);
}

/**
 * The newest release tag in a GitHub `releases.atom` feed (entries are newest-first). Reads the
 * tag out of the first entry's `/releases/tag/<tag>` link, falling back to the `<id>` suffix.
 * Returns null when no entry is present (empty feed / parse miss) — the caller treats null as
 * "no signal", never as a change.
 */
export function latestAtomTag(xml: string): string | null {
  const link = xml.match(/\/releases\/tag\/([^"'\s<>]+)/);
  if (link?.[1] !== undefined) return decodeURIComponent(link[1]);
  const id = xml.match(/<id>[^<]*Repository\/[^<]*\/([^<]+)<\/id>/);
  return id?.[1] ?? null;
}

/**
 * Plain-text of every `<tr>` in an HTML table (tags stripped, whitespace collapsed), dropping
 * empty and pure-header rows. Used as row ids for a set-difference "what's new" over listings
 * whose exact markup we don't control (e.g. the HHS OCR breach portal).
 * ponytail: text-of-row granularity, not a schema-aware parse — upgrade to per-column
 * extraction only if a portal's row text proves too noisy to diff cleanly.
 */
export function extractTableRows(html: string): string[] {
  const rows: string[] = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const inner = m[1] ?? "";
    if (/<th\b/i.test(inner)) continue; // header row
    const text = normalize(inner.replace(/<[^>]+>/g, " "));
    if (text.length > 0) rows.push(text);
  }
  return rows;
}

/** Items in `current` not present in `previous` — the "new entries since last run" signal. */
export function newItems(
  previous: readonly string[],
  current: readonly string[],
): string[] {
  const seen = new Set(previous);
  return current.filter((item) => !seen.has(item));
}
