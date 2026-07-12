// The judged-replay rubric (CAISSON-101). The HYBRID judge: accuracy + grounding are graded
// DETERMINISTICALLY in code here (no model, no tokens); actionability is graded by the cassette's
// embedded LLM verdicts via `@caisson/ai-evals`' `judgeGrader(cassetteJudge(...))`. All graders are
// wired into two pooled `defineEval` runs in `intel-briefs.eval.test.ts` — split by THRESHOLD, not
// by scope: the deterministic scorers demand a perfect 1.0 (a replay that doesn't exactly reproduce
// the recorded finding is a harness bug), while the judged scorer runs at 0.7 (a model verdict is
// fuzzier). `defineEval` applies every scorer to every case, so the deterministic run mixes two case
// kinds — one per replayed finding, plus one "count" case per cassette — and each grader passes
// trivially on a case kind it does not own (an accuracy check is not applicable to a count case, and
// vice versa). That is deliberate: a not-applicable pass keeps the mean honest for the cases the
// grader DOES own.
import { parseFinding } from "../finding.ts";
import type { Finding } from "../finding.ts";
import type { Grader } from "@caisson/ai-evals";

/** The fixed actionability rubric prose — decision-usefulness. Shared verbatim between the live
 *  recorder (record.cli.ts prompts the judge with it) and the replay grader (judgeGrader's fixed
 *  criteria), so the recorded verdict and the replayed check are graded against the SAME rubric. */
export const ACTIONABILITY_CRITERIA =
  "Judge whether this operator-intelligence brief is DECISION-USEFUL. A useful brief tells the " +
  "operator, concretely: WHAT changed, WHY it matters, and WHAT to do about it. Pass only when the " +
  "brief is concrete and grounded in the facts given — not speculative, not vague, not padded. Fail " +
  "a brief that merely restates raw numbers with no read on their meaning or on any action.";

// --- Case model ---------------------------------------------------------------------------------
// The deterministic run mixes two case kinds; `input.kind` discriminates them so each grader can no-op
// on the kind it does not own. A finding case carries the replayed finding as its `output` (stable
// JSON); a count case carries the replayed finding COUNT as its `output` and the recorded count in
// `expected`.

export type ReplayCaseKind = "finding" | "count";

/** Read the discriminator from a case's `input`, defaulting to "finding" for a bare input. */
function caseKind(input: unknown): ReplayCaseKind {
  if (input !== null && typeof input === "object" && "kind" in input) {
    const k = (input as { kind: unknown }).kind;
    if (k === "count") return "count";
  }
  return "finding";
}

const pass = (rationale: string) => ({ score: 1, pass: true, rationale });
const fail = (rationale: string) => ({ score: 0, pass: false, rationale });

// --- Stable serialization (order-independent deep equality) -------------------------------------

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) out[key] = sortKeys(src[key]);
    return out;
  }
  return value;
}

/** Canonical (sorted-key) JSON of a value — two findings are equal iff their canonical forms match,
 *  independent of key insertion order. */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

// --- Accuracy ----------------------------------------------------------------------------------

/**
 * Per-finding deterministic equality: the replayed finding (the case's `output`) must deep-equal the
 * recorded finding with the same `dedupKey` (the case id). Both sides pass through `parseFinding` and
 * `stableSerialize` first, so the compare is byte-stable and boundary-validated. A finding present in
 * the recording but absent from the replay (no matching case output would be built, but a stray
 * lookup miss is still handled) fails loudly. No-ops as a pass on a count case.
 */
export function accuracyGrader(recorded: readonly Finding[]): Grader {
  const byKey = new Map<string, string>();
  for (const f of recorded)
    byKey.set(f.dedupKey, stableSerialize(parseFinding(f)));
  return ({ caseId, input, output }) => {
    if (caseKind(input) !== "finding")
      return pass("accuracy n/a for a count case");
    const want = byKey.get(caseId);
    if (want === undefined)
      return fail(`no recorded finding for dedupKey "${caseId}"`);
    let got: string;
    try {
      got = stableSerialize(parseFinding(JSON.parse(output) as Finding));
    } catch (err) {
      return fail(
        `replayed finding did not parse: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return got === want
      ? pass("replayed finding is byte-identical to the recorded one")
      : fail("replayed finding differs from the recorded one");
  };
}

// --- No-extra-findings (the count case) ---------------------------------------------------------

/**
 * The count case: the replayed finding count (the case's `output`) must equal the recorded count
 * (the case's `expected.recordedCount`). This catches an EXTRA replayed finding that accuracy alone
 * would miss — accuracy only checks findings that HAVE a recorded case, so a replay that invented an
 * additional finding would slip past it. Reads the target from `expected` (not a wiring-time closure)
 * because in a pooled multi-cassette run the count is per-case. No-ops as a pass on a finding case.
 */
export function noExtraFindingsGrader(): Grader {
  return ({ input, output, expected }) => {
    if (caseKind(input) !== "count")
      return pass("count check n/a for a finding case");
    const recordedCount =
      expected !== null &&
      typeof expected === "object" &&
      "recordedCount" in expected
        ? Number((expected as { recordedCount: unknown }).recordedCount)
        : Number.NaN;
    const actual = Number(output);
    return actual === recordedCount
      ? pass(`replayed count ${String(actual)} matches recorded`)
      : fail(
          `replayed count ${String(actual)} != recorded ${String(recordedCount)}`,
        );
  };
}

// --- Grounding ----------------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s"'<>)\]}]+/g;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Every http(s) URL that appears in the replayed finding's body + payload must resolve to a host the
 * watcher actually fetched (i.e. present in `exchangeHosts`). This is the anti-hallucination check:
 * a deterministic watcher only ever emits URLs it constructed from configured/fetched sources, so a
 * URL pointing at an unfetched host is a grounding failure. Checked against the recorded exchange
 * hosts only — no `caisson.sh`/`github.com` convenience allowlist, because no watcher constructs a
 * finding URL outside what it fetched (competitor → the watched page's own host; posthog error → the
 * PostHog app host it queried; github/analytics emit no URLs). No URLs in a finding ⇒ pass. No-ops as
 * a pass on a count case.
 */
export function groundingGrader(exchangeHosts: ReadonlySet<string>): Grader {
  return ({ input, output }) => {
    if (caseKind(input) !== "finding")
      return pass("grounding n/a for a count case");
    let finding: Finding;
    try {
      finding = JSON.parse(output) as Finding;
    } catch (err) {
      return fail(
        `replayed finding did not parse: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const haystack = `${finding.body} ${JSON.stringify(finding.payload)}`;
    const urls = haystack.match(URL_RE) ?? [];
    const ungrounded = urls
      .map(hostOf)
      .filter(
        (host): host is string => host !== null && !exchangeHosts.has(host),
      );
    return ungrounded.length === 0
      ? pass("every finding URL is grounded in a fetched host")
      : fail(`ungrounded URL host(s): ${[...new Set(ungrounded)].join(", ")}`);
  };
}
