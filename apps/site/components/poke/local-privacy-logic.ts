// Deterministic client-side mirror of @caisson/local-privacy's EgressGuard.assertAllowed decision
// (ADR-0064, "local-privacy" module) for the "local-privacy" poke (ADR-0378 lock 2). Every export
// below reproduces the real package's pure decision logic; nothing here fetches, persists, measures,
// or uses Date.now / Math.random in a rendered-output path.
//
// Why mirrored instead of imported: `egress-guard.ts` and `policy.ts` both import from
// "@caisson/kernel" (the bare package specifier, not a subpath), which resolves to the kernel
// barrel `index.ts`. That barrel re-exports `ssrf.ts` (`node:dns/promises`), `crypto.ts` and
// `audit-chain.ts` / `migration-assembly.ts` (`node:crypto`) alongside the browser-safe pieces
// (`errors.ts`, `schema.ts`, `fetch.ts`) it also needs — kernel's `package.json` `exports` map has
// no subpath around those files, so none of it resolves in a browser bundle. The decision surface
// this poke exercises (`assertAllowed`'s scheme/allowlist checks) touches no crypto and no network,
// so nothing here needs WebCrypto — it is a line-for-line, dependency-free port of the same checks
// in the same order. Parity is pinned in `local-privacy-logic.test.ts` against the real
// `EgressGuard.assertAllowed` (imported by relative path — apps/site does not declare
// `@caisson/local-privacy` as a dependency), which bun's node-like test runtime can resolve even
// though a browser bundle cannot.

// ---- Policy (packages/local-privacy/src/policy.ts) ----------------------------------------------

/** Verbatim: policy.ts `SANCTIONED_SINK_KINDS`. The closed set of egress reasons. */
export const SANCTIONED_SINK_KINDS = ["model-fetch", "rented-backend"] as const;
export type SanctionedSinkKind = (typeof SANCTIONED_SINK_KINDS)[number];

/** Verbatim: policy.ts `PRIVACY_MODES`. `local-only` is the sole member — no hosted mode exists. */
export const PRIVACY_MODES = ["local-only"] as const;
export type PrivacyMode = (typeof PRIVACY_MODES)[number];

export interface EgressSink {
  readonly host: string;
  readonly kind: SanctionedSinkKind;
}

export interface PrivacyPolicy {
  readonly privacy: PrivacyMode;
  readonly allowlist: readonly EgressSink[];
}

/** Mirrors policy.ts `localOnlyPolicy` — an omitted allowlist defaults to `[]` (zero egress). */
export function localOnlyPolicy(
  allowlist: readonly EgressSink[] = [],
): PrivacyPolicy {
  return { privacy: "local-only", allowlist };
}

/** Verbatim: policy.ts `ZERO_EGRESS_POLICY` — the air-gap default, every host blocked. */
export const ZERO_EGRESS_POLICY: PrivacyPolicy =
  Object.freeze(localOnlyPolicy());

/**
 * The real sanctioned model-fetch host (onnx-backend.ts `DEFAULT_ONNX_MODEL.modelHost`) — the
 * actual first-run download host the on-device inference backend allowlists, not a fabricated
 * example.
 */
export const MODEL_FETCH_HOST = "huggingface.co";

/** A real shipped policy shape: `localOnlyPolicy` with the one sanctioned model-fetch sink open. */
export const MODEL_FETCH_POLICY: PrivacyPolicy = Object.freeze(
  localOnlyPolicy([{ host: MODEL_FETCH_HOST, kind: "model-fetch" }]),
);

// ---- The decision (packages/local-privacy/src/egress-guard.ts `assertAllowed`) -------------------

/** Mirrors kernel `CaissonError` shape for `ValidationError` (400) / `AuthzError` (403) only. */
export interface EgressErrorLike {
  readonly code: "validation_error" | "forbidden";
  readonly httpStatus: 400 | 403;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type EgressVerdict =
  | {
      readonly outcome: "allowed";
      readonly url: string;
      readonly host: string;
      readonly kind: SanctionedSinkKind;
    }
  | { readonly outcome: "blocked"; readonly error: EgressErrorLike };

/**
 * Mirrors `EgressGuard.assertAllowed` exactly, as a non-throwing decision (guardrails-poke's
 * `evaluateGuard` precedent): malformed URL first, then non-https scheme, then allowlist lookup.
 * Empty allowlist ⇒ this always falls through to the last branch ⇒ zero egress.
 */
export function evaluateEgress(
  input: string,
  policy: PrivacyPolicy,
): EgressVerdict {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return {
      outcome: "blocked",
      error: {
        code: "validation_error",
        httpStatus: 400,
        message: "egress blocked: malformed URL",
      },
    };
  }
  if (url.protocol !== "https:") {
    return {
      outcome: "blocked",
      error: {
        code: "forbidden",
        httpStatus: 403,
        message: "egress blocked: non-https scheme",
        details: { scheme: url.protocol },
      },
    };
  }
  const host = url.hostname.toLowerCase();
  const allow = new Map(
    policy.allowlist.map((sink) => [sink.host, sink.kind] as const),
  );
  const kind = allow.get(host);
  if (kind === undefined) {
    return {
      outcome: "blocked",
      error: {
        code: "forbidden",
        httpStatus: 403,
        message:
          "egress blocked: host not on the privacy allowlist (fail-closed-to-offline)",
        details: { host, privacy: policy.privacy },
      },
    };
  }
  return { outcome: "allowed", url: url.href, host, kind };
}
