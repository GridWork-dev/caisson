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

// ── Hash-mode content delta (CAISSON-101) ──────────────────────────────────────────────────────
// A detection hash proves THAT a hash-mode page changed, never WHAT changed — so a notice built from
// hashes alone ("content changed, review the page") is not decision-useful, and the actionability
// judge fails it. Alongside the hash we persist a bounded, normalized text snapshot; on the next
// change we trim the stored snapshot against the current text to their longest common prefix/suffix
// and emit the divergent middle (plus a little surrounding context) as a before/after excerpt pair
// the brief composer can turn into a concrete "what changed".
//
// ponytail: the snapshot is capped at SNAPSHOT_MAX_CHARS. A change PAST that window leaves the two
// captured windows identical, so the delta degrades to a current-only head excerpt and the composer
// keeps its honest "content-level delta unavailable" fallback. Raise the cap, or move to a
// section-addressable source (the EUR-Lex API), if buried-tail changes must be diffed.
const SNAPSHOT_MAX_CHARS = 16_000;
const EXCERPT_MAX_CHARS = 1_200;
const CONTEXT_CHARS = 160;
const DELTA_URL_RE = /https?:\/\/[^\s"'<>)\]}]+/g;

/** The bounded, normalized snapshot persisted next to a hash-mode detection hash — the exact text
 *  the hash is computed over, capped, so a later change can be diffed against it. */
export function snapshotOf(text: string): string {
  return normalize(text).slice(0, SNAPSHOT_MAX_CHARS);
}

/** Strip embedded URLs and hard-cap length. Excerpts are operator prose, not a link list; the
 *  grounding grader (threshold 1.0) also rejects any finding URL whose host the watcher did not
 *  fetch, so a stray link inside page text would fail replay — neutralize it here. */
function cleanExcerpt(text: string): string {
  const stripped = text.replace(DELTA_URL_RE, "[link]");
  return stripped.length > EXCERPT_MAX_CHARS
    ? `${stripped.slice(0, EXCERPT_MAX_CHARS)}…`
    : stripped;
}

export interface TextDelta {
  /** The changed region of the CURRENT text (with a little surrounding context). Always present. */
  currentExcerpt: string;
  /** The changed region of the PREVIOUS text. Absent when no prior snapshot was stored (the first
   *  change after this capture shipped, or a daemon that only ever stored a bare hash) or the change
   *  lies beyond the captured window. */
  previousExcerpt?: string;
}

function commonPrefixLen(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function commonSuffixLen(a: string, b: string, prefixLen: number): number {
  const max = Math.min(a.length, b.length) - prefixLen;
  let i = 0;
  while (
    i < max &&
    a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)
  )
    i++;
  return i;
}

/** The changed span [start,end) of `text` widened by CONTEXT_CHARS on each side, ellipsis-marked. */
function changedWindow(text: string, start: number, end: number): string {
  const from = Math.max(0, start - CONTEXT_CHARS);
  const to = Math.min(text.length, end + CONTEXT_CHARS);
  const core = `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
  return cleanExcerpt(core);
}

/**
 * Before/after content delta for a hash-mode change. `previousSnapshot` is the bounded normalized
 * text stored on the last observation (undefined the first time the new capture sees a source, or if
 * the daemon has only ever stored a bare hash). Trims both sides to their longest common
 * prefix/suffix so the excerpts are the CHANGED region plus context — not the whole page. Every axis
 * is bounded (see the *_CHARS caps). Callers invoke this only on a confirmed hash change.
 */
export function textDelta(
  currentText: string,
  previousSnapshot: string | undefined,
): TextDelta {
  const cur = snapshotOf(currentText);
  if (previousSnapshot === undefined || previousSnapshot.length === 0) {
    return { currentExcerpt: cleanExcerpt(cur) };
  }
  const prefix = commonPrefixLen(cur, previousSnapshot);
  const suffix = commonSuffixLen(cur, previousSnapshot, prefix);
  // Identical within the captured window (the real change is beyond the cap) — no diffable region;
  // fall back to a current-only excerpt so the composer keeps its honest hash-only notice.
  if (prefix === cur.length && prefix === previousSnapshot.length) {
    return { currentExcerpt: cleanExcerpt(cur) };
  }
  return {
    currentExcerpt: changedWindow(cur, prefix, cur.length - suffix),
    previousExcerpt: changedWindow(
      previousSnapshot,
      prefix,
      previousSnapshot.length - suffix,
    ),
  };
}
