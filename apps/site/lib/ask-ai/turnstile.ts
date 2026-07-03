// Cloudflare Turnstile server-side verification (ADR-0234 F5: Turnstile gates /api/ask from day one,
// FAIL-CLOSED). Unlike the waitlist route (Turnstile optional / fail-open when unconfigured), the paid
// LLM route fails CLOSED: a missing or invalid token is rejected, and a missing SECRET in production is
// rejected too (a misconfigured prod must not run an unprotected, monetizable-abuse route). A dev/CI
// instance with no secret bypasses (same posture as the BYOK field-crypto demo vector) so `bun test` /
// `bun dev` need no Cloudflare account. TURNSTILE_SECRET is server-only; only NEXT_PUBLIC_TURNSTILE_SITE_KEY
// (the widget render key, used by the UI phase) is public.
import { fetchWithTimeout } from "@caisson/kernel";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileConfig {
  /** TURNSTILE_SECRET (server-only). Empty/undefined = unconfigured. */
  readonly secret: string | undefined;
  /** True in production — an unconfigured secret then FAILS CLOSED (rejects). */
  readonly isProduction: boolean;
  /** Verify-call timeout in ms. */
  readonly timeoutMs?: number;
}

/** A verifier: given the client's Turnstile token (and client IP), resolve whether the request may pass. */
export type TurnstileVerifier = (
  token: string | undefined,
  ip: string,
) => Promise<boolean>;

/**
 * Build the Turnstile verifier. Fail-closed contract:
 *  - secret set   → a token is required; verified against Cloudflare siteverify; any failure (bad token,
 *                   non-2xx, network/timeout) → reject.
 *  - secret unset → production rejects (fail closed); non-production bypasses (dev/CI convenience).
 */
export function makeTurnstileVerifier(cfg: TurnstileConfig): TurnstileVerifier {
  const secret = cfg.secret ?? "";
  return async (token, ip) => {
    if (secret.length === 0) {
      // Unconfigured: fail closed in prod, bypass in dev/CI.
      return !cfg.isProduction;
    }
    if (token === undefined || token.length === 0) return false;
    try {
      const form = new URLSearchParams({ secret, response: token });
      if (ip.length > 0) form.set("remoteip", ip);
      const res = await fetchWithTimeout(
        SITEVERIFY_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        },
        { timeoutMs: cfg.timeoutMs ?? 5_000 },
      );
      if (!res.ok) return false;
      const outcome = (await res.json()) as { success?: boolean };
      return outcome.success === true;
    } catch {
      // Can't verify the challenge → don't admit the request (fail closed).
      return false;
    }
  };
}
