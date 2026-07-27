// Evaluation-access verification scoring (ADR-0280 hybrid scoring, refines ADR-0274 §2). The PURE
// half of the anti-exfiltration verification floor: given an applicant work-email and a set of
// domain SIGNALS (MX / registration age / optional enrichment — resolved by `eval-signals.ts`, kept
// OUT of this file so the scorer is deterministic + network-free in tests), produce one of three
// decisions — `auto_reject`, `review`, `auto_approve`. FAIL-CLOSED by construction: the free-mail /
// disposable pre-gate rejects outright, a missing MX rejects, and auto-approve requires POSITIVE
// evidence (MX present + a known, sufficiently-old domain) — every uncertainty widens toward the
// operator review queue, NEVER toward approval (ADR-0280: "fail-toward-manual, never fail-open").
//
// Thresholds are CONFIG, never constants (ADR-0274/0280): `loadEvalConfig` reads them from env,
// Zod-validated, with fail-closed-safe defaults. Static free-mail / disposable domain lists are the
// launch floor; a fuller maintained list is a data-file follow-up (see the list comment).
import { isBundleId } from "@caisson/registry-schema";
import { getDomain } from "tldts";
import { z } from "zod";

/** The three verification outcomes (ADR-0280). `review` = the operator queue (borderline). */
export type EvalDecision = "auto_reject" | "review" | "auto_approve";

/**
 * Domain signals resolved out-of-band (`eval-signals.ts`) and fed to the pure scorer. Every field is
 * three-valued — `undefined` means "could not determine" (lookup unset/failed/timed out), which the
 * scorer treats as UNCERTAINTY (widen toward review), never as a pass.
 */
export interface DomainSignals {
  /** true = MX records present · false = definitively none · undefined = unknown (lookup failed). */
  readonly mx: boolean | undefined;
  /** Domain registration age in whole days · undefined = unknown (RDAP unset/failed). */
  readonly ageDays: number | undefined;
  /** Optional enrichment risk 0..100 (higher = riskier) · undefined = enrichment unavailable. */
  readonly enrichmentRisk: number | undefined;
}

export interface EvalScore {
  readonly decision: EvalDecision;
  /** 0..100 computed risk (higher = riskier) — audit / operator context, not itself the gate. */
  readonly risk: number;
  /** Short machine reason for the decision (audit trail; never echoes the applicant's raw input). */
  readonly reason: string;
}

/** Validated verification config (ADR-0274/0280 — thresholds are config, never constants). */
export interface EvalConfig {
  /** Eval license window length in days (ADR-0274 §2 "~14 days"). */
  readonly windowDays: number;
  /** How long an approved-but-unissued / pending application holds its domain slot before it expires. */
  readonly applicationTtlDays: number;
  /** Global concurrent-eval cap across all domains (ADR-0274 floor: "a global concurrent-eval cap"). */
  readonly globalActiveCap: number;
  /** Minimum domain registration age (days) for auto-approve — younger domains never auto-approve. */
  readonly domainMinAgeDays: number;
  /** risk <= this AND positive evidence ⇒ auto_approve. */
  readonly autoApproveMaxRisk: number;
  /** risk >= this ⇒ auto_reject. */
  readonly autoRejectMinRisk: number;
}

// Risk contributions. Deliberately coarse (this is a triage gate, not a fraud model): the precise
// escalation to device fingerprinting / ML scoring is ADR-0280's demand-driven Option 3.
// ponytail: fixed additive weights, not a learned model — upgrade to Option 3 only when volume
// justifies it (ADR-0280 Consequences).
//
// Calibration principle: pure ABSENCE of signal must never by itself cross the auto-reject cutoff —
// an all-unknown applicant (e.g. RDAP + enrichment both disabled, MX transiently unresolved) lands in
// the REVIEW queue (fail-toward-manual), not auto-rejected. Auto-reject is reserved for a DEFINITIVE
// bad signal (no MX / free-mail / disposable — hard pre-gates above) or a young domain stacked with
// uncertainty / a high enrichment score. With the default cutoffs (approve<=25, reject>=70) the sums
// hold this: all-unknown = 20+25+15 = 60 (review); young + two unknowns = 35+20+15 = 70 (reject).
const RISK_MX_UNKNOWN = 20;
const RISK_AGE_UNKNOWN = 25;
const RISK_AGE_YOUNG = 35;
const RISK_ENRICHMENT_UNKNOWN = 15;

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Extract + normalize the REGISTRABLE domain (eTLD+1) from a work email: the substring after the
 * LAST `@`, reduced through the public-suffix list. Returns `null` for a structurally invalid
 * address (no `@`, empty local part, more than one `@`, whitespace) OR an unresolvable domain
 * (`tldts#getDomain` — an IP literal, bare `localhost`, or a domain with no recognizable suffix) —
 * the caller maps `null` to `auto_reject`. Bounded: the email is length-capped by the Zod boundary
 * before it reaches here.
 *
 * REGISTRABLE, not the raw FQDN (F3 hardening, ADR-0274 "one active eval per org domain"):
 * `a.corp.com` / `b.corp.com` / `corp.com` all reduce to the SAME `corp.com` slot — a naive
 * FQDN-as-domain-slot let an applicant mint unlimited concurrent evals off one organization by
 * varying the subdomain. `tldts` is the maintained public-suffix-list implementation (already an
 * indirect dependency via `tough-cookie`, now direct here) — hand-rolling "last two labels" is
 * WRONG for multi-label public suffixes (`corp.co.uk` must reduce to `corp.co.uk`, not `co.uk`).
 */
export function extractDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (/\s/.test(trimmed)) return null;
  const at = trimmed.indexOf("@");
  // Exactly one `@`, with a non-empty local part.
  if (at <= 0 || trimmed.indexOf("@", at + 1) !== -1) return null;
  const fqdn = trimmed.slice(at + 1);
  if (fqdn.length === 0) return null;
  return getDomain(fqdn);
}

// The launch free-mail floor (ADR-0274: "verified work email on a company domain (no free-mail)").
// A curated set of the highest-volume consumer providers — not exhaustive. A fuller/maintained list
// is a data-file follow-up; the review queue catches anything this set misses (fail-toward-manual).
const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "tutanota.com",
  "qq.com",
  "163.com",
  "126.com",
]);

// The launch disposable / throwaway floor (ADR-0280 pre-gate: "disposable-email list"). Same
// curated-not-exhaustive posture as the free-mail set — a maintained list is a follow-up.
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "getnada.com",
  "trashmail.com",
  "yopmail.com",
  "sharklasers.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mintemail.com",
  "mohmal.com",
  "spam4.me",
  "mailnesia.com",
  "discard.email",
]);

/** True if `domain` is a known free-mail (consumer) provider — rejected outright (ADR-0274 floor). */
export const isFreeMailDomain = (domain: string): boolean =>
  FREE_MAIL_DOMAINS.has(domain);

/** True if `domain` is a known disposable / throwaway provider — rejected outright (ADR-0280). */
export const isDisposableDomain = (domain: string): boolean =>
  DISPOSABLE_DOMAINS.has(domain);

// The eval scope-ceiling floor (ADR-0274 §2 "unlocks the evaluated modules for the window" — an
// unpaid trial, not a full-catalog grant). `expandEntitlements` only proves a requested id RESOLVES;
// it says nothing about how MUCH access resolving it grants, so `everything` ($2,259, the full
// catalog) or several bundles at once would otherwise sail through as a "valid" eval scope. Bounded
// here instead: an eval scope is either ONE bundle (never `everything`) alone, or a small module-only
// set.
export const MAX_EVAL_MODULE_IDS = 6;

/**
 * Validate the SHAPE of a requested eval scope (a ceiling, not an existence check — resolvability
 * against the registry index is still `expandEntitlements`'s job, run separately at /eval/issue).
 * Returns a caller-facing rejection reason, or `null` when the shape is allowed:
 *
 *  - `everything` anywhere in the request → rejected (the full catalog is never an eval scope).
 *  - More than one bundle id → rejected (one bundle is the ceiling for a bundle-shaped eval).
 *  - A bundle id mixed with any other id → rejected (a bundle already grants its whole member set;
 *    mixing widens beyond "a single bundle").
 *  - Zero bundle ids and more than {@link MAX_EVAL_MODULE_IDS} module ids → rejected.
 *
 * Pure + no I/O, so it is directly unit-testable independent of the HTTP route.
 */
export function validateEvalScope(
  entitlements: readonly string[],
): string | null {
  if (entitlements.includes("everything")) {
    return "the full catalog is not an eval scope — request a single bundle or a small module set";
  }
  const bundleIds = entitlements.filter((id) => isBundleId(id));
  if (bundleIds.length > 1) {
    return "an eval scope may include at most one bundle";
  }
  if (bundleIds.length === 1 && entitlements.length > 1) {
    return "an eval scope may not mix a bundle with additional ids";
  }
  if (bundleIds.length === 0 && entitlements.length > MAX_EVAL_MODULE_IDS) {
    return `an eval scope of individual modules is capped at ${String(MAX_EVAL_MODULE_IDS)} ids`;
  }
  return null;
}

/**
 * Score an eval application (ADR-0280 hybrid scoring). Pure + deterministic over (email, signals,
 * config). The order encodes the fail-closed floor:
 *
 *  1. Invalid email                → auto_reject.
 *  2. Free-mail / disposable domain → auto_reject (ADR-0274 floor, no scoring).
 *  3. Definitively no MX            → auto_reject (a domain that cannot receive mail is not a work domain).
 *  4. Risk score from age + enrichment (+ MX uncertainty); every UNKNOWN adds risk (never subtracts).
 *  5. Bucket: risk >= autoRejectMinRisk → auto_reject · risk <= autoApproveMaxRisk AND positive
 *     evidence (MX present + known age >= min) → auto_approve · otherwise → review.
 *
 * The auto-approve gate is intentionally stricter than the score alone: auto-approve NEVER fires
 * without a concrete positive signal (MX present + a known, sufficiently-old domain), so a
 * low-but-uncertain application always lands in the review queue rather than being waved through.
 */
export function scoreApplication(
  email: string,
  signals: DomainSignals,
  config: EvalConfig,
): EvalScore {
  const domain = extractDomain(email);
  if (domain === null) {
    return { decision: "auto_reject", risk: 100, reason: "invalid-email" };
  }
  if (isFreeMailDomain(domain)) {
    return { decision: "auto_reject", risk: 100, reason: "free-mail-domain" };
  }
  if (isDisposableDomain(domain)) {
    return { decision: "auto_reject", risk: 100, reason: "disposable-domain" };
  }
  if (signals.mx === false) {
    return { decision: "auto_reject", risk: 100, reason: "no-mx" };
  }

  let risk = 0;
  if (signals.mx === undefined) risk += RISK_MX_UNKNOWN;
  if (signals.ageDays === undefined) {
    risk += RISK_AGE_UNKNOWN;
  } else if (signals.ageDays < config.domainMinAgeDays) {
    risk += RISK_AGE_YOUNG;
  }
  if (signals.enrichmentRisk === undefined) {
    risk += RISK_ENRICHMENT_UNKNOWN;
  } else {
    // Scale the 0..100 enrichment signal to a bounded contribution (half-weight — one of several
    // inputs, never the sole gate).
    risk += Math.round(clamp100(signals.enrichmentRisk) / 2);
  }
  risk = clamp100(risk);

  if (risk >= config.autoRejectMinRisk) {
    return { decision: "auto_reject", risk, reason: "risk-over-reject-cutoff" };
  }
  const positiveEvidence =
    signals.mx === true &&
    signals.ageDays !== undefined &&
    signals.ageDays >= config.domainMinAgeDays;
  if (risk <= config.autoApproveMaxRisk && positiveEvidence) {
    return { decision: "auto_approve", risk, reason: "established-domain" };
  }
  return { decision: "review", risk, reason: "borderline-to-review" };
}

const PosInt = z.coerce.number().int().positive();
const Risk0to100 = z.coerce.number().int().min(0).max(100);

// Env → EvalConfig. Every value is optional with a fail-closed-safe default; a present-but-invalid
// value fails startup closed (server.ts calls this at boot) rather than serving with a silently-wrong
// threshold. `.strict()` is not applicable (process.env is a flat string map); the schema reads only
// the keys it names.
const EvalConfigEnv = z.object({
  EVAL_WINDOW_DAYS: PosInt.default(14),
  EVAL_APPLICATION_TTL_DAYS: PosInt.default(7),
  EVAL_GLOBAL_ACTIVE_CAP: PosInt.default(50),
  EVAL_DOMAIN_MIN_AGE_DAYS: PosInt.default(90),
  EVAL_AUTO_APPROVE_MAX_RISK: Risk0to100.default(25),
  EVAL_AUTO_REJECT_MIN_RISK: Risk0to100.default(70),
});

/**
 * Load the verification config from env (ADR-0274/0280 — thresholds are operator-tunable config).
 * Throws (fail-closed startup) when a provided value is invalid OR when the approve/reject cutoffs
 * cross (autoApproveMaxRisk >= autoRejectMinRisk would leave no review band — a misconfig that could
 * auto-approve what should be reviewed).
 */
export function loadEvalConfig(
  env: NodeJS.ProcessEnv = process.env,
): EvalConfig {
  const parsed = EvalConfigEnv.parse(env);
  const config: EvalConfig = {
    windowDays: parsed.EVAL_WINDOW_DAYS,
    applicationTtlDays: parsed.EVAL_APPLICATION_TTL_DAYS,
    globalActiveCap: parsed.EVAL_GLOBAL_ACTIVE_CAP,
    domainMinAgeDays: parsed.EVAL_DOMAIN_MIN_AGE_DAYS,
    autoApproveMaxRisk: parsed.EVAL_AUTO_APPROVE_MAX_RISK,
    autoRejectMinRisk: parsed.EVAL_AUTO_REJECT_MIN_RISK,
  };
  if (config.autoApproveMaxRisk >= config.autoRejectMinRisk) {
    throw new Error(
      "EVAL_AUTO_APPROVE_MAX_RISK must be strictly below EVAL_AUTO_REJECT_MIN_RISK (no review band otherwise)",
    );
  }
  return config;
}
