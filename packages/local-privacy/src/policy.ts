// src/privacy/policy.ts — the runtime privacy POLICY for the Local-first AI edition (ADR-0064).
// The marquee promise is "your data never leaves the device", so
// the policy is the single declarative source the egress guard (`egress-guard.ts`) enforces.
//
// The posture is ZERO-EGRESS-BY-DEFAULT, fail-closed-to-offline:
//   - `privacy` is a CLOSED enum whose only member is `"local-only"`. There is deliberately no
//     `"hosted"` mode — a future network posture cannot be introduced by config; it needs an ADR +
//     a schema change. The enum exists so the closed `.strict()` shape documents that local-only is
//     THE posture, not a default someone can flip.
//   - The `allowlist` is the ONLY way a host becomes reachable, and every entry must declare one of
//     two SANCTIONED sink kinds (the model-fetch host; the rented-backend host). An
//     arbitrary host for an arbitrary reason is not expressible — the kind enum is closed.
//   - An empty / omitted allowlist = ZERO egress (the air-gap default). There is no implicit host.
//
// `.strict()` everywhere (ADR-0002): an unknown top-level key or an unknown sink key fails closed —
// a typo'd or smuggled field never silently widens the egress surface.
import { parseStrict, strictObject } from "@caisson-sh/kernel/browser";
import { z } from "zod";

/**
 * The two — and only two — sanctioned egress sink kinds. Every
 * allowlist entry is one of these; the enum is CLOSED so a host can only ever be opened for a reason
 * the threat model already accounts for:
 *
 * - `model-fetch`     — the first-run model download host (the ONNX backend). Hash-pinned, and
 *                       air-gap adopters pre-seed the cache so even this host is never contacted.
 * - `rented-backend`  — the opt-in metered hosted-inference host (the rented backend seam).
 *                       Off by default; reachable only when the deployer explicitly allowlists it.
 */
export const SANCTIONED_SINK_KINDS = ["model-fetch", "rented-backend"] as const;

/** Zod enum over {@link SANCTIONED_SINK_KINDS}. An unknown kind fails strict parsing (fail-closed). */
export const sinkKindSchema = z.enum(SANCTIONED_SINK_KINDS);

/** A sanctioned egress sink kind. */
export type SanctionedSinkKind = z.infer<typeof sinkKindSchema>;

/**
 * The closed set of privacy modes. `local-only` is the sole member: zero egress except the
 * explicitly-allowlisted sanctioned sinks. There is no hosted mode by construction.
 */
export const PRIVACY_MODES = ["local-only"] as const;

/** Zod enum over {@link PRIVACY_MODES}. */
export const privacyModeSchema = z.enum(PRIVACY_MODES);

/** The privacy posture. Only `"local-only"` exists — see {@link PRIVACY_MODES}. */
export type PrivacyMode = z.infer<typeof privacyModeSchema>;

/**
 * A bare, lowercase hostname — no scheme, port, path, userinfo, or query. The egress guard matches
 * this EXACTLY against `URL.hostname` (no suffix/wildcard matching — a wildcard would be a hole). The
 * value is trimmed + lowercased before validation so matching is case-insensitive and canonical.
 */
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;

/** One allowlisted egress sink: an exact host + its sanctioned reason. `.strict()` — no extra keys. */
export const egressSinkSchema = strictObject({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(253)
    .regex(
      HOSTNAME_RE,
      "must be a bare lowercase hostname (no scheme, port, path, or wildcard)",
    ),
  kind: sinkKindSchema,
});

/** A validated, normalized allowlist entry. */
export type EgressSink = z.infer<typeof egressSinkSchema>;

/**
 * The runtime privacy policy. `allowlist` defaults to `[]` — so the safe default, and a policy that
 * omits it, is ZERO egress. Bounded to 16 entries (a local-first edition has at most a model host +
 * a rented-backend host; a long allowlist is a smell the bound surfaces).
 */
export const privacyPolicySchema = strictObject({
  privacy: privacyModeSchema,
  allowlist: z.array(egressSinkSchema).max(16).default([]),
});

/** A validated runtime privacy policy. `allowlist` is always present (defaulted to `[]`). */
export type PrivacyPolicy = z.infer<typeof privacyPolicySchema>;

/**
 * Parse + normalize an untrusted policy object, throwing a redaction-safe `ValidationError` on any
 * unknown key, bad host, unknown sink kind, or unknown privacy mode. The single boundary every
 * policy passes through before the egress guard trusts it (the guard re-parses defensively).
 */
export function parsePrivacyPolicy(input: unknown): PrivacyPolicy {
  return parseStrict(privacyPolicySchema, input);
}

/** Convenience: a validated `local-only` policy from an allowlist (default `[]` ⇒ zero egress). */
export function localOnlyPolicy(
  allowlist: readonly EgressSink[] = [],
): PrivacyPolicy {
  return parsePrivacyPolicy({ privacy: "local-only", allowlist });
}

/**
 * The air-gap default: `local-only` with an empty allowlist ⇒ EVERY outbound host is blocked. The
 * baseline an edition installs unless the deployer explicitly opts a sanctioned sink in.
 */
export const ZERO_EGRESS_POLICY: PrivacyPolicy =
  Object.freeze(localOnlyPolicy());
