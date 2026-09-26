/**
 * Registered feature-tag set (ADR-0074) — the closed registry of `feature` discriminators that base
 * `credits` accepts on a generic `feature_debit` / `feature_grant` event. Editions meter a NEW action
 * by registering its tag HERE (the `registry/` seam, ADR-0074) — never by mutating the base
 * `credit_event` event-type enum (ADR-0007/0024) and never by depending "up" on an edition
 * (ADR-0003/0022). The base validates a supplied tag against this set at the debit boundary; an
 * unregistered / typo tag fails closed, so a typo cannot mint a silent new meter (threat TM-D).
 *
 * Base owns the typed envelope (`feature_debit`/`feature_grant`); editions own the tag value here.
 */
import { z } from "zod";

/**
 * The registered discriminators — each names ONE metered action across the editions:
 *  - `evidence_pack`   — Compliance evidence-pack generation
 *  - `inference_call`  — AI Production Kit metered inference
 *  - `codegen_run`     — create-caisson codegen generation
 *  - `eval_run`        — per eval-run metering (ADR-0007 proven unit)
 *  - `audit_scan`      — per audit-scan metering (ADR-0007 proven unit)
 *  - `gpu_minute`      — per caption / GPU-minute metering (ADR-0007 proven unit)
 *
 * Extend DELIBERATELY: a new metered action lands a row here in the same change that meters it.
 */
export const REGISTERED_FEATURE_TAGS = [
  "evidence_pack",
  "inference_call",
  "codegen_run",
  "eval_run",
  "audit_scan",
  "gpu_minute",
  // ADR-0220 — an operator credit correction rides the feature envelope under this tag.
  "admin_adjust",
] as const;

export type FeatureTag = (typeof REGISTERED_FEATURE_TAGS)[number];

/**
 * Closed Zod enum over the registered set. `z.enum` is strict by construction — only a registered
 * member parses; any other string (a typo, an unregistered action) is rejected. This is the single
 * source of truth the base credit boundary validates against (fail-closed).
 */
export const FeatureTagSchema = z.enum(REGISTERED_FEATURE_TAGS);

/**
 * Assert a caller-supplied tag is registered, narrowing to `FeatureTag`. Fail-closed: an unregistered
 * tag throws. Registry depends only on `zod` (not `@caisson-sh/kernel`), so this raises a plain `Error`;
 * the base `credits` boundary maps the same rejection to a typed `ValidationError` (HTTP 400).
 */
export function assertRegisteredFeatureTag(
  tag: unknown,
): asserts tag is FeatureTag {
  if (!FeatureTagSchema.safeParse(tag).success) {
    throw new Error(
      `unregistered feature tag: ${JSON.stringify(tag)} (registered: ${REGISTERED_FEATURE_TAGS.join(", ")})`,
    );
  }
}
