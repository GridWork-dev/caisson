// Template token-replace + JSON deep-merge for the generator engine (P5, ADR-0048).
// NO templating runtime — tokens are double-brace literals only ({{token}}), resolved
// from a typed map. Unknown tokens are left verbatim; the caller inspects `unresolved`
// to surface gaps. Deep merge is deterministic: object keys are sorted lexicographically
// at every level; array-merge policy is REPLACE (an override array wholly replaces the
// base array — no concatenation, no deduplication).

// ── JSON value types ─────────────────────────────────────────────────────────

/** A JSON-serialisable primitive. */
type JsonPrimitive = string | number | boolean | null;

/** A JSON-serialisable value (recursive). */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/** A JSON-serialisable object — the unit `deepMerge` operates on. */
export type JsonObject = { readonly [key: string]: JsonValue };

// ── Token replace ────────────────────────────────────────────────────────────

/** The result of a single token-replace pass over a template string. */
export interface TokenReplaceResult {
  /** The template string with all known `{{token}}` occurrences substituted. */
  readonly content: string;
  /**
   * Token names that appeared in the template (inside `{{ }}`), but were absent from
   * the `tokens` map. These placeholders are left verbatim in `content`. Callers may
   * choose to error, warn, or ignore depending on context — this function does not throw
   * on unresolved tokens, it only reports them.
   */
  readonly unresolved: ReadonlySet<string>;
}

/**
 * Replace `{{token}}` placeholders in `template` with values from `tokens`.
 *
 * Policy:
 * - Token names are matched exactly as written between `{{` and `}}` (no whitespace trimming,
 *   no coercion). Token names may not contain `{` or `}` characters.
 * - A `{{token}}` whose key is absent from `tokens` is left verbatim in `content` and
 *   added to `unresolved` — it is NOT an error here; the caller decides severity.
 * - The same unknown token appearing multiple times appears exactly once in `unresolved`.
 * - No templating runtime, no network, no fs side-effects (ADR-0068).
 *
 * @param template - The file content string containing `{{token}}` placeholders.
 * @param tokens   - A map of token name → replacement string.
 */
export function replaceTokens(
  template: string,
  tokens: Readonly<Record<string, string>>,
): TokenReplaceResult {
  const unresolved = new Set<string>();
  const content = template.replace(
    /\{\{([^{}]+)\}\}/g,
    (match, key: string) => {
      const val = tokens[key];
      if (val !== undefined) {
        return val;
      }
      unresolved.add(key);
      return match; // leave verbatim — do NOT error
    },
  );
  return { content, unresolved };
}

// ── JSON deep-merge ──────────────────────────────────────────────────────────

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `override` into `base`, producing a new `JsonObject`.
 *
 * Rules (deterministic):
 * - Object keys in the output are sorted lexicographically at every level — the same
 *   `(base, override)` pair always produces identical output regardless of insertion order.
 * - When both `base` and `override` hold an object at the same key, the objects are merged
 *   recursively (same rules apply).
 * - **Array-merge policy = REPLACE**: when a key holds an array in either operand, the
 *   override value (or base value if override is absent) is taken wholesale — no
 *   concatenation, no deduplication. This matches `package.json` workspaces /
 *   `tsconfig.json` `include` patterns, where concatenating two arrays would produce
 *   duplicate entries or contradictory flags.
 * - `override` wins on all scalar collisions.
 * - Pure function — neither operand is mutated.
 */
export function deepMerge(base: JsonObject, override: JsonObject): JsonObject {
  const merged: Record<string, JsonValue> = {};
  const allKeys = [
    ...new Set([...Object.keys(base), ...Object.keys(override)]),
  ].sort();

  for (const key of allKeys) {
    const baseVal = base[key]; // JsonValue | undefined (noUncheckedIndexedAccess)
    const overVal = override[key]; // JsonValue | undefined

    if (overVal === undefined && baseVal !== undefined) {
      // key only in base — carry forward
      merged[key] = baseVal;
    } else if (overVal !== undefined && baseVal === undefined) {
      // key only in override — take it
      merged[key] = overVal;
    } else if (overVal !== undefined && baseVal !== undefined) {
      // key in both — recurse on nested objects; otherwise override wins (array REPLACE)
      merged[key] =
        isJsonObject(baseVal) && isJsonObject(overVal)
          ? deepMerge(baseVal, overVal)
          : overVal;
    }
    // Both undefined is structurally impossible: key came from Object.keys of one or both.
  }

  return merged;
}
