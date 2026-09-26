// LemonSqueezy webhook signature verification (ADR-0175). Extracted into its own open verify-only file
// (billing carve, ADR-0249 G3 — uniform rule: signature-verify open for all four providers). NO SDK —
// hand-rolled over the raw request body, mirroring the Stripe/Paddle/Polar verifiers' no-SDK posture.
import { createHmac } from "node:crypto";
import { AuthnError, safeEqualFixed } from "@caisson-sh/kernel/node";

/** Throws `AuthnError` unless `signatureHeader` is a valid LemonSqueezy `X-Signature`. LemonSqueezy's
 * signature is a bare HMAC-SHA256 hex digest of the raw body — no timestamp, so (unlike Stripe/Paddle)
 * there is no replay-tolerance window to check (this matches LemonSqueezy's own documented Node example:
 * a single `timingSafeEqual` over the digest, nothing else). */
export function verifyLemonSqueezyWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): void {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!safeEqualFixed(expected, signatureHeader)) {
    throw new AuthnError("Invalid LemonSqueezy signature");
  }
}
