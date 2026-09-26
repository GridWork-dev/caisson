// FTC "4 Ps" (clear-and-conspicuous) dark-pattern presentation guardrail (ADR-0215 —
// rebuild-clean). A pure, deterministic heuristic evaluator over MARKETING/UI
// COPY — not a request/response leg (see `guard.ts` for the live gateway chokepoint). Five rule
// classes over named FTC dark-pattern categories; each finding is scored against the P dimension it
// violates (prominence / presentation / placement / proximity). No LLM in the hot path — a judge can
// layer on top via the `Moderator` port, never inside this evaluator.
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";
import { customModerator } from "./moderator.ts";
import type { Moderator } from "./moderator.ts";

export const FTC_4P_DIMENSIONS = [
  "prominence",
  "presentation",
  "placement",
  "proximity",
] as const;
export type Ftc4PDimension = (typeof FTC_4P_DIMENSIONS)[number];

export const ftc4pFindingSchema = strictObject({
  dimension: z.enum(FTC_4P_DIMENSIONS),
  rule: z.string().min(1),
  severity: z.enum(["info", "warn", "block"]),
  excerpt: z.string().max(200),
});
export type Ftc4PFinding = z.infer<typeof ftc4pFindingSchema>;

export const ftc4pResultSchema = strictObject({
  scores: strictObject({
    prominence: z.number().min(0).max(1),
    presentation: z.number().min(0).max(1),
    placement: z.number().min(0).max(1),
    proximity: z.number().min(0).max(1),
  }),
  findings: z.array(ftc4pFindingSchema),
  flagged: z.boolean(),
});
export type Ftc4PResult = z.infer<typeof ftc4pResultSchema>;

/** Score penalty applied to a finding's dimension, per severity (clipped at 0). */
const PENALTY: Record<Ftc4PFinding["severity"], number> = {
  block: 0.6,
  warn: 0.3,
  info: 0.1,
};

/** How far (chars) around a trigger match a required disclosure may appear to satisfy it. */
const DISCLOSURE_WINDOW = 80;

interface Ftc4PRule {
  readonly id: string;
  readonly dimension: Ftc4PDimension;
  readonly severity: Ftc4PFinding["severity"];
  /** Global regex — every match is a candidate finding. */
  readonly trigger: RegExp;
  /**
   * When set, a `trigger` match only becomes a finding if NO `disclosure` match appears within
   * `DISCLOSURE_WINDOW` chars before/after it (the clear-and-conspicuous "nearby disclosure" test —
   * e.g. a real deadline near an urgency claim, a cancel/price-after clause near a free trial).
   * Omitted for rules where the wording itself IS the violation (confirmshaming, opt-out framing) —
   * no nearby text neutralizes manipulative phrasing.
   */
  readonly disclosure?: RegExp;
}

const RULES: readonly Ftc4PRule[] = [
  {
    id: "false-urgency",
    dimension: "prominence",
    severity: "block",
    // Scarcity/urgency claims without a genuine, verifiable deadline nearby.
    trigger:
      /\b(hurry|act now|limited time|only \d+ (left|remaining)|ends (today|soon)|while supplies last|don'?t miss out|offer expires)\b/gi,
    // A concrete date or time counts as a real, checkable deadline.
    disclosure:
      /\b(\d{1,2}\/\d{1,2}(\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\d{1,2}:\d{2}\s?(am|pm)?)\b/gi,
  },
  {
    id: "forced-continuity",
    dimension: "proximity",
    severity: "block",
    // A free/trial offer with no cancel-anytime or post-trial price disclosure nearby.
    trigger: /\b(free trial|trial period)\b/gi,
    disclosure:
      /\b(cancel\s?(anytime|any time|before)|then \$\d+(\.\d{2})?|billed at \$\d+(\.\d{2})?|\$\d+(\.\d{2})?\s?\/\s?(mo|month|yr|year))\b/gi,
  },
  {
    id: "confirmshaming",
    dimension: "presentation",
    severity: "block",
    // Guilt-framed decline copy ("No, I don't want to save money…") — the wording itself is the
    // violation; no disclosure neutralizes it.
    trigger:
      /\bno,?\s+i\s+(don'?t|do not)\s+(want|like|care|need)\b[^.!?]{0,60}(save|discount|deal|offer|money|free)\b/gi,
  },
  {
    id: "opt-out-enrollment",
    dimension: "placement",
    severity: "block",
    // Enrollment defaulted to ON, opt-out framed (pre-checked box, "unless you uncheck") — a
    // placement dark pattern regardless of any nearby copy.
    trigger:
      /\b(automatically (enroll|enrolled|sign you up|subscribe|subscribed|charge|charged)|pre-?checked|unless you (opt out|uncheck))\b/gi,
  },
  {
    id: "drip-pricing",
    dimension: "proximity",
    severity: "block",
    // A headline price with no mandatory-fee qualifier nearby.
    trigger: /\b(starting at|only|just|from)\s*\$\d+(\.\d{2})?\b/gi,
    disclosure:
      /\b(plus (tax|fees)|service fee|processing fee|\+\s?fees|excludes (tax|fees)|additional fees may apply|taxes? and fees?)\b/gi,
  },
];

/** `true` when `disclosure` matches within `DISCLOSURE_WINDOW` chars of `[start, end)` in `text`. */
function hasNearbyDisclosure(
  text: string,
  disclosure: RegExp,
  start: number,
  end: number,
): boolean {
  const lo = Math.max(0, start - DISCLOSURE_WINDOW);
  const hi = Math.min(text.length, end + DISCLOSURE_WINDOW);
  const nearby = text.slice(lo, hi);
  // Reset before every call: a global-flagged regex carries a sticky `lastIndex`, and reusing the
  // same `RegExp` instance across findings/calls would otherwise silently miss a later match.
  disclosure.lastIndex = 0;
  return disclosure.test(nearby);
}

/**
 * Score marketing/UI `copy` against the FTC clear-and-conspicuous "4 Ps" — pure, deterministic, no
 * network/LLM call. A trigger without its required nearby disclosure (or an unconditional wording
 * violation) appends a finding and penalizes that finding's dimension; `flagged` when any dimension
 * drops under 0.5 or any finding is `severity: "block"`.
 */
export function evaluateFtc4P(copy: string): Ftc4PResult {
  const scores: Record<Ftc4PDimension, number> = {
    prominence: 1,
    presentation: 1,
    placement: 1,
    proximity: 1,
  };
  const findings: Ftc4PFinding[] = [];

  for (const rule of RULES) {
    for (const m of copy.matchAll(rule.trigger)) {
      if (m.index === undefined) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (
        rule.disclosure !== undefined &&
        hasNearbyDisclosure(copy, rule.disclosure, start, end)
      ) {
        continue;
      }
      findings.push({
        dimension: rule.dimension,
        rule: rule.id,
        severity: rule.severity,
        excerpt: m[0].slice(0, 200),
      });
      scores[rule.dimension] = Math.max(
        0,
        scores[rule.dimension] - PENALTY[rule.severity],
      );
    }
  }

  const flagged =
    findings.some((f) => f.severity === "block") ||
    Object.values(scores).some((s) => s < 0.5);

  return ftc4pResultSchema.parse({ scores, findings, flagged });
}

/**
 * Wrap `evaluateFtc4P` as a `Moderator` (category `"custom"`) — an adopter opts it into `guardOutput`
 * with zero `guard.ts` change (this evaluator scores static copy, not a request/response leg).
 * `threshold` sets the minimum acceptable per-dimension score in ADDITION to `evaluateFtc4P`'s own
 * `flagged` verdict (block-severity findings or any dimension already under 0.5).
 */
export function ftc4pModerator(threshold = 0.5): Moderator {
  return customModerator((text) => {
    const result = evaluateFtc4P(text);
    const flagged =
      result.flagged || Object.values(result.scores).some((s) => s < threshold);
    return { flagged, category: "custom" };
  });
}
