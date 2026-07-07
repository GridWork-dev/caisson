/**
 * Pure fuzzy subsequence matching behind CommandPalette — dependency-free, case-insensitive. A query
 * matches when all of its characters appear in order (not necessarily adjacent) in the target. The
 * score rewards contiguous runs and matches at a word boundary, so "dtp" ranks "DataTablePro" above a
 * scattered hit. Kept free of React so it is unit-tested directly and reused for any list filter.
 */

export interface FuzzyMatch {
  /** Higher is a better match. */
  score: number;
  /** Indices in the target that the query characters matched (for highlighting). */
  indices: number[];
}

const WORD_BOUNDARY = /[\s\-_./:]/;

/**
 * Greedy left-to-right subsequence match of `query` in `text`. Returns `null` when not every query
 * character is found in order. An empty query matches everything with score 0.
 *
 * ponytail: greedy first-occurrence, not an optimal DP alignment — good enough to rank a command
 * list; upgrade to a Smith-Waterman-style DP only if match quality ever measurably matters.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  if (query === "") return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices: number[] = [];
  let qi = 0;
  let score = 0;
  let prev = -2;
  let ti = 0;
  for (; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    let s = 1;
    if (ti === prev + 1) s += 5; // contiguous run
    if (ti === 0 || WORD_BOUNDARY.test(t[ti - 1]!)) s += 10; // word start
    score += s;
    indices.push(ti);
    prev = ti;
    qi++;
  }
  if (qi < q.length) return null;
  // Slight preference for the query landing early in a shorter target.
  score -= indices.length > 0 ? indices[0]! * 0.1 : 0;
  return { score, indices };
}

/**
 * Filter `items` to those whose `key` fuzzy-matches `query`, ranked best-first (stable on ties by
 * original index). An empty/whitespace query returns every item in original order.
 */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  key: (item: T) => string,
): T[] {
  const q = query.trim();
  if (q === "") return [...items];
  const scored: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const m = fuzzyMatch(q, key(item));
    if (m) scored.push({ item, score: m.score, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map((s) => s.item);
}
