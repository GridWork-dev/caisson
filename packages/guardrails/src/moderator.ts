// The `Moderator` port (ADR-0063) — the swappable content-moderation seam the guardrails layer
// calls at the gateway's input/output points. Three drivers ship: a `local` regex driver (zero
// network, the cheap default), a `provider` driver that wraps an INJECTED check (test-doubled in
// CI — guardrails itself makes NO outbound call; a real provider adapter uses `fetchWithTimeout`
// per the kernel floor), and a `custom` hook. The `forge.config` policy block is the serializable
// selection (`.strict()` — unknown keys rejected); the live `Moderator` instance is built from it.
import { z } from "zod";
import { strictObject, ValidationError } from "@caisson-sh/kernel/browser";
import { assertBoundedGuardText } from "./pii-core.ts";

const MAX_MODERATOR_PATTERNS = 256;
const MAX_MODERATOR_PATTERN_CODE_UNITS = 500;
const MAX_MODERATOR_QUANTIFIERS = 32;
const MAX_MODERATOR_REPETITION = 1_000;

/**
 * The violation class a block is charted by. Mirrors `kernel/observability`
 * `guardrailBlockSchema`. `"secret"` (ADR-0215) is the unconditional credential-shape pre-screen in
 * `guard.ts` — it never comes from a `Moderator` verdict.
 */
export type GuardCategory =
  | "moderation"
  | "pii"
  | "injection"
  | "secret"
  | "custom";

/**
 * A moderation verdict. **Metadata only** — `category` is the class the dashboard charts by, never
 * the flagged content or matched text (echoing it would defeat the redaction the guard enforces).
 */
export interface ModerationResult {
  readonly flagged: boolean;
  readonly category: GuardCategory;
}

/** The port. Editions/the gateway depend on this; a driver (local | provider | custom) backs it. */
export interface Moderator {
  moderate(text: string): ModerationResult | Promise<ModerationResult>;
}

const PASS: ModerationResult = { flagged: false, category: "moderation" };
const moderationResultSchema = strictObject({
  flagged: z.boolean(),
  // `secret` belongs exclusively to the unconditional pre-screen, never a moderator verdict.
  category: z.enum(["moderation", "pii", "injection", "custom"]),
});

/** Parse an untrusted driver result without stripping unknown fields. */
export function parseModerationResult(value: unknown): ModerationResult {
  return moderationResultSchema.parse(value);
}

/**
 * The `forge.config` moderator policy block (`.strict()`). The serializable knobs only — the live
 * `Moderator` is built from this via the driver factories below. `failOpen` defaults to `false`
 * (fail-closed, ADR-0063): a moderator outage BLOCKS unless an operator explicitly opts out.
 */
export const moderatorPolicySchema = strictObject({
  driver: z.enum(["local", "provider", "custom"]),
  failOpen: z.boolean().default(false),
  /** Per-call deadline (ms). A moderator that exceeds it is treated as an outage → fail-closed. */
  timeoutMs: z.number().int().positive().max(60_000).default(2_000),
  /** Regex sources for the `local` driver / cheap pre-screen. Compiled case-insensitive. */
  blocklist: z
    .array(z.string().min(1).max(MAX_MODERATOR_PATTERN_CODE_UNITS))
    .max(MAX_MODERATOR_PATTERNS)
    .default([]),
});
export type ModeratorPolicy = z.infer<typeof moderatorPolicySchema>;

interface RegexGroupState {
  hasAlternation: boolean;
  hasQuantifier: boolean;
}

function unsafeRegex(): never {
  throw new ValidationError("guardrails: unsafe moderator regex pattern");
}

function braceQuantifier(
  source: string,
  start: number,
): { end: number; unbounded: boolean; maximum: number } | undefined {
  const end = source.indexOf("}", start + 1);
  if (end === -1) return undefined;
  const body = source.slice(start + 1, end);
  const comma = body.indexOf(",");
  const minimumText = comma === -1 ? body : body.slice(0, comma);
  const maximumText = comma === -1 ? body : body.slice(comma + 1);
  if (
    minimumText.length === 0 ||
    [...minimumText].some((char) => char < "0" || char > "9") ||
    (comma !== -1 &&
      [...maximumText].some((char) => char < "0" || char > "9")) ||
    body.indexOf(",", comma + 1) !== -1
  ) {
    return undefined;
  }
  const minimum = Number(minimumText);
  const maximum =
    comma === -1
      ? minimum
      : maximumText.length === 0
        ? Number.POSITIVE_INFINITY
        : Number(maximumText);
  // `{n,}` (maximum Infinity) is NOT excessive repetition — it is the same shape as `+` and is
  // budgeted by the unbounded-wide-atom rule below, exactly like `*`/`+`. Only a bounded maximum
  // trips the ceiling; the minimum needs its own explicit bound now that Infinity is exempt.
  const bounded = maximum !== Number.POSITIVE_INFINITY;
  if (
    !Number.isSafeInteger(minimum) ||
    maximum < minimum ||
    minimum > MAX_MODERATOR_REPETITION ||
    (bounded && maximum > MAX_MODERATOR_REPETITION)
  ) {
    unsafeRegex();
  }
  return { end, unbounded: !bounded, maximum };
}

/**
 * Conservative, allocation-bounded safety screen for caller-configured patterns. It rejects
 * backreferences, lookarounds, nested quantifiers (at any nesting depth), alternation groups
 * quantified to repeat more than once, more than one unbounded wide-atom quantifier
 * (`.`/character classes/`\w`-style escapes under `*`, `+`, or `{n,}`), and excessive bounded
 * repetition. `?`/`{0,1}` on a group is allowed — one repetition cannot multiply backtracking
 * paths. Static package detectors do not pass through this seam.
 */
export function assertSafeModeratorPattern(source: string): void {
  if (source.length > MAX_MODERATOR_PATTERN_CODE_UNITS) {
    throw new ValidationError(
      `guardrails: moderator regex pattern exceeds ${MAX_MODERATOR_PATTERN_CODE_UNITS} code units`,
    );
  }
  const groups: RegexGroupState[] = [
    { hasAlternation: false, hasQuantifier: false },
  ];
  let lastClosedGroup: RegexGroupState | undefined;
  let lastAtom: "wide" | "group" | "other" | undefined;
  let previousWasQuantifier = false;
  let quantifiers = 0;
  let unboundedWildcards = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === "\\") {
      const escaped = source[index + 1];
      if (escaped !== undefined && escaped >= "1" && escaped <= "9") {
        unsafeRegex();
      }
      index += escaped === undefined ? 0 : 1;
      // `\w`/`\d`/`\s` classes match wide — an unbounded quantifier on one is budget-counted
      // exactly like `.` (repeated `\w*\s*…` runs are a measured polynomial burn).
      lastAtom =
        escaped !== undefined && "wWdDsS".includes(escaped) ? "wide" : "other";
      lastClosedGroup = undefined;
      previousWasQuantifier = false;
      continue;
    }
    if (char === "[") {
      let escaped = false;
      for (index += 1; index < source.length; index += 1) {
        const classChar = source[index]!;
        if (!escaped && classChar === "]") break;
        if (!escaped && classChar === "\\") {
          escaped = true;
        } else {
          escaped = false;
        }
      }
      // A character class is a wide atom: `[a-z]*[a-z]*…` backtracks like `.*.*`.
      lastAtom = "wide";
      lastClosedGroup = undefined;
      previousWasQuantifier = false;
      continue;
    }
    if (char === "(") {
      if (source[index + 1] === "?") {
        if (source[index + 2] !== ":") unsafeRegex();
        index += 2;
      }
      groups.push({ hasAlternation: false, hasQuantifier: false });
      lastAtom = undefined;
      lastClosedGroup = undefined;
      previousWasQuantifier = false;
      continue;
    }
    if (char === ")") {
      if (groups.length > 1) {
        lastClosedGroup = groups.pop();
        lastAtom = "group";
      } else {
        lastAtom = undefined;
      }
      previousWasQuantifier = false;
      continue;
    }
    if (char === "|") {
      // Propagate to every OPEN group (as the quantifier flag already does): recording only the
      // innermost group let one extra nesting level hide the alternation from the quantified
      // group's check — `((a|a))+` was accepted while `(a|a)+` was rejected.
      for (const group of groups) group.hasAlternation = true;
      lastAtom = undefined;
      lastClosedGroup = undefined;
      previousWasQuantifier = false;
      continue;
    }

    let quantifierEnd = index;
    let unbounded = char === "*" || char === "+";
    // `?`/`{0,1}`/`{1}` repeat at most once and cannot multiply backtracking paths — only a
    // quantifier that can repeat a group MORE than once makes an alternation/quantifier inside
    // it dangerous.
    let repeatsMoreThanOnce = unbounded;
    let isQuantifier = char === "*" || char === "+" || char === "?";
    if (char === "{") {
      const brace = braceQuantifier(source, index);
      if (brace !== undefined) {
        isQuantifier = true;
        quantifierEnd = brace.end;
        unbounded = brace.unbounded;
        repeatsMoreThanOnce = brace.unbounded || brace.maximum > 1;
      }
    }
    if (isQuantifier) {
      // `+?`, `*?`, and `{m,n}?` are lazy suffixes, not a second quantifier.
      if (char === "?" && previousWasQuantifier) {
        previousWasQuantifier = false;
        continue;
      }
      quantifiers += 1;
      if (quantifiers > MAX_MODERATOR_QUANTIFIERS) unsafeRegex();
      if (
        repeatsMoreThanOnce &&
        lastAtom === "group" &&
        (lastClosedGroup?.hasAlternation === true ||
          lastClosedGroup?.hasQuantifier === true)
      ) {
        unsafeRegex();
      }
      if (lastAtom === "wide" && unbounded) {
        unboundedWildcards += 1;
        if (unboundedWildcards > 1) unsafeRegex();
      }
      for (const group of groups) group.hasQuantifier = true;
      index = quantifierEnd;
      lastClosedGroup = undefined;
      previousWasQuantifier = true;
      continue;
    }

    lastAtom = char === "." ? "wide" : "other";
    lastClosedGroup = undefined;
    previousWasQuantifier = false;
  }
}

export function assertSafeModeratorRegexes(patterns: readonly RegExp[]): void {
  if (patterns.length > MAX_MODERATOR_PATTERNS) {
    throw new ValidationError(
      `guardrails: moderator regex count exceeds ${MAX_MODERATOR_PATTERNS}`,
    );
  }
  for (const pattern of patterns) {
    assertSafeModeratorPattern(pattern.source);
  }
}

/** Compile bounded, screened sources to case-insensitive `RegExp`. */
export function compileBlocklist(sources: readonly string[]): RegExp[] {
  if (sources.length > MAX_MODERATOR_PATTERNS) {
    throw new ValidationError(
      `guardrails: moderator regex count exceeds ${MAX_MODERATOR_PATTERNS}`,
    );
  }
  for (const source of sources) assertSafeModeratorPattern(source);
  const patterns: RegExp[] = [];
  for (const source of sources) {
    try {
      // No `g` flag — these are tested with `.test()`, where a sticky lastIndex would skip matches.
      patterns.push(new RegExp(source, "i"));
    } catch {
      throw new ValidationError(
        "guardrails: invalid moderator blocklist pattern",
      );
    }
  }
  return patterns;
}

/** The `local` driver — a zero-network regex moderator. Any blocklist hit flags as `moderation`. */
export function localModerator(sources: readonly string[]): Moderator {
  const patterns = compileBlocklist(sources);
  return {
    moderate(text: string): ModerationResult {
      assertBoundedGuardText(text);
      for (const re of patterns) {
        if (re.test(text)) return { flagged: true, category: "moderation" };
      }
      return PASS;
    },
  };
}

/**
 * The `provider` driver — wraps an INJECTED check. Guardrails makes no network call itself (it is a
 * port boundary); the buyer's real adapter performs the HTTP call with `fetchWithTimeout`, and CI
 * injects a test double. This keeps the live transport the only un-exercised path.
 */
export function providerModerator(
  check: (text: string) => Promise<ModerationResult>,
): Moderator {
  return { moderate: (text) => check(text) };
}

/** The `custom` hook driver. A thrown hook surfaces as an outage → fail-closed at the guard. */
export function customModerator(
  hook: (text: string) => ModerationResult | Promise<ModerationResult>,
): Moderator {
  return { moderate: (text) => hook(text) };
}

/**
 * Run a moderator under a deadline. Resolves with the verdict, or REJECTS on timeout / driver error
 * — the guard catches a rejection and fails closed (unless an explicit `failOpen` policy is set).
 * Synchronous driver throws are normalized into the rejection too.
 */
export function moderateWithDeadline(
  moderator: Moderator,
  text: string,
  timeoutMs: number,
): Promise<ModerationResult> {
  assertBoundedGuardText(text);
  const verdict = Promise.resolve().then(() => moderator.moderate(text));
  // A pending driver promise that later settles after the deadline must not surface as an unhandled
  // rejection once the race is decided against it.
  verdict.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("guardrails: moderator deadline exceeded")),
      timeoutMs,
    );
  });
  return Promise.race([verdict, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
