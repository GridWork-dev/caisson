/**
 * Pure structured-diff behind DiffViewer — line-based text diff (LCS) and JSON key-path diff. No
 * React, no dependency. Redaction reuses `redact.ts` so a secret-bearing JSON key is masked in BOTH
 * the before and after panes (a changed secret reads `[redacted] → [redacted]`, never leaking whether
 * or how it changed). Kept free of the DOM so both the on-screen render and any copy path diff alike.
 */

import { redactValue } from "./redact.ts";

export type LineOp = "same" | "add" | "remove";

export interface LineChange {
  op: LineOp;
  text: string;
  /** 1-based line number in the before text (absent on an added line). */
  beforeLine?: number;
  /** 1-based line number in the after text (absent on a removed line). */
  afterLine?: number;
}

/**
 * Line-based diff of `before` vs `after` via a longest-common-subsequence backtrack. Common lines are
 * `same`; the rest are `remove` (from before) then `add` (from after), in source order.
 *
 * ponytail: O(n·m) DP table, capped at ~4M cells (≈2k×2k lines) — past that it degrades to a
 * naive all-remove/all-add diff instead of allocating unboundedly; swap for Myers if huge
 * mostly-similar inputs ever need a real diff.
 */
export function diffLines(before: string, after: string): LineChange[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > 4_000_000) {
    return [
      ...a.map<LineChange>((text, i) => ({
        op: "remove",
        text,
        beforeLine: i + 1,
      })),
      ...b.map<LineChange>((text, j) => ({
        op: "add",
        text,
        afterLine: j + 1,
      })),
    ];
  }
  // lcs[i][j] = LCS length of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: LineChange[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({
        op: "same",
        text: a[i]!,
        beforeLine: i + 1,
        afterLine: j + 1,
      });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ op: "remove", text: a[i]!, beforeLine: i + 1 });
      i++;
    } else {
      out.push({ op: "add", text: b[j]!, afterLine: j + 1 });
      j++;
    }
  }
  for (; i < n; i++) out.push({ op: "remove", text: a[i]!, beforeLine: i + 1 });
  for (; j < m; j++) out.push({ op: "add", text: b[j]!, afterLine: j + 1 });
  return out;
}

export type JsonChangeKind = "added" | "removed" | "changed";

export interface JsonChange {
  /** Dotted/bracketed path from the root, e.g. `$.user.name` or `$.items[0]`. */
  path: string;
  kind: JsonChangeKind;
  /** Present for `removed` and `changed`. Already redaction-masked when `redactKeys` was supplied. */
  before?: unknown;
  /** Present for `added` and `changed`. Already redaction-masked when `redactKeys` was supplied. */
  after?: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) => k in b && deepEqual(a[k], b[k]))
    );
  }
  return false;
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  out: JsonChange[],
): void {
  if (deepEqual(before, after)) return;
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) walk(before[k], after[k], `${path}.${k}`, out);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++)
      walk(before[i], after[i], `${path}[${i}]`, out);
    return;
  }
  if (before === undefined) out.push({ path, kind: "added", after });
  else if (after === undefined) out.push({ path, kind: "removed", before });
  else out.push({ path, kind: "changed", before, after });
}

/**
 * Key-path diff of two JSON-serializable values. Objects are compared per key, arrays per index, and
 * every differing leaf becomes an `added`/`removed`/`changed` entry keyed by its root path. When
 * `redactKeys` is supplied, both sides are masked through `redactValue` first, so secret-bearing
 * keys never surface a real value in either pane. The set is lowercased here — `isRedactedKey`
 * lowercases only the payload key, so a mixed-case caller set would otherwise silently not match.
 */
export function diffJson(
  before: unknown,
  after: unknown,
  redactKeys?: ReadonlySet<string>,
): JsonChange[] {
  const keys = redactKeys
    ? new Set([...redactKeys].map((k) => k.toLowerCase()))
    : undefined;
  const b = keys ? redactValue(before, keys) : before;
  const a = keys ? redactValue(after, keys) : after;
  const out: JsonChange[] = [];
  walk(b, a, "$", out);
  return out;
}
